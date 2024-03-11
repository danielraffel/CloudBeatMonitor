// Required Google Cloud modules and initialization of Firestore and Compute Engine APIs
const {Firestore} = require('@google-cloud/firestore');
const {google} = require('googleapis');
const compute = google.compute('v1');
const firestore = new Firestore();

// The main Cloud Function to check VM heartbeat and potentially restart it
exports.checkVMHeartbeatAndRestart = async (req, res) => {
  // Configuration variables: VM identifier, Google Cloud project ID, and the static IP of the VM
  const vmId = 'YOUR_VM_ID'; // Placeholder - replace with your actual VM ID
  const projectId = 'YOUR_PROJECT_ID'; // Placeholder - replace with your Google Cloud Project ID
  const targetIP = 'YOUR_STATIC_IP'; // Placeholder - replace with the static IP address of your VM

  // Log the start of a heartbeat check
  console.log(`Checking heartbeat for VM: ${vmId}`);

  // Attempt to retrieve the heartbeat document for the VM from Firestore
  const heartbeatDocRef = firestore.collection('heartbeats').doc(vmId);
  const heartbeatDoc = await heartbeatDocRef.get();

  // If the document does not exist, log an error and send a 404 response
  if (!heartbeatDoc.exists) {
    console.error(`No heartbeat document found for VM: ${vmId}`);
    return res.status(404).send('VM heartbeat document does not exist');
  }

  // Extract the lastHeartbeat timestamp from the document and calculate how long ago it was
  const {lastHeartbeat} = heartbeatDoc.data();
  const now = Firestore.Timestamp.now();
  const diff = now.seconds - lastHeartbeat.seconds; // Difference in seconds
  console.log(`Last heartbeat was ${diff} seconds ago for VM: ${vmId}`);

  // If the last heartbeat was within the last 2 minutes, assume the VM is active
  if (diff <= 120) {
    console.log(`VM: ${vmId} is active.`);
    return res.status(200).send('VM is active.');
  } else {
    // If the VM appears inactive, check the resuscitation timestamp to avoid frequent restarts
    const resuscitationDocRef = firestore.collection('resuscitation').doc(vmId);
    const resuscitationDoc = await resuscitationDocRef.get();
    let lastResuscitationTime = null;
    if (resuscitationDoc.exists) {
      lastResuscitationTime = resuscitationDoc.data().lastHeartbeat;
    }

    // Calculate the time since the last restart attempt
    const timeSinceLastResuscitation = lastResuscitationTime ? now.seconds - lastResuscitationTime.seconds : Infinity;
    if (timeSinceLastResuscitation <= 300) { // If less than 5 minutes, skip restarting
      console.log(`VM: ${vmId} restart was attempted less than 5 minutes ago. Skipping restart.`);
      return res.status(429).send('Restart skipped due to recent attempt');
    }

    // Authenticate with Google Cloud and prepare to search for the VM instance
    const auth = await google.auth.getClient({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    let instanceToRestart = null;
    let zoneToRestart = null;

    // List all zones in the project to search for the VM instance
    const zonesResponse = await compute.zones.list({ project: projectId, auth: auth });
    const zones = zonesResponse.data.items.map(zone => zone.name);

    // Search each zone for instances and match by external IP address
    for (const zone of zones) {
      const instancesResponse = await compute.instances.list({ project: projectId, zone: zone, auth: auth });
      const instances = instancesResponse.data.items || [];

      for (const instance of instances) {
        const instanceName = instance.name;
        const externalIP = instance.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP;

        if (externalIP === targetIP) {
          instanceToRestart = instanceName;
          zoneToRestart = zone;
          console.log(`Instance to restart found: ${instanceName} in zone: ${zone}`);
          break; // Found the instance; stop searching
        }
      }

      if (instanceToRestart) {
        break; // Found the instance; stop searching other zones
      }
    }

    // If no matching instance was found, log an error and send a 404 response
    if (!instanceToRestart) {
      console.error(`No matching instance found for IP: ${targetIP}`);
      return res.status(404).send('No matching instance found');
    }

    // Prepare the request to check the instance's status
    const request = {
      project: projectId,
      zone: zoneToRestart,
      instance: instanceToRestart,
      auth: auth
    };

    try {
      // Get the instance's details to determine its current status
      const instanceDetails = await compute.instances.get(request);
      const status = instanceDetails.data.status;

      // If RUNNING, reset the instance; if STOPPED or TERMINATED, start it
      if (status === 'RUNNING') {
        console.log(`Instance ${instanceToRestart} is running and will be reset.`);
        await compute.instances.reset(request);
      } else if (status === 'TERMINATED' || status === 'STOPPED') {
        console.log(`Instance ${instanceToRestart} is stopped/terminated and will be started.`);
        await compute.instances.start(request);
      }

      // Log the successful operation and update the resuscitation timestamp
      console.log(`Operation completed on VM instance ${instanceToRestart}.`);
      await resuscitationDocRef.set({
        lastHeartbeat: Firestore.Timestamp.now()
      }, {merge: true});
      console.log(`Resuscitation timestamp updated for VM: ${vmId}.`);
      res.status(200).send(`Operation completed and resuscitation timestamp updated for ${vmId}`);
    } catch (err) {
      // If an error occurred, log it and send a 500 response
      console.error(`Error performing operation on VM: ${err}`);
      res.status(500).send('Failed to perform operation on VM');
    }
  }
};
