const {Firestore} = require('@google-cloud/firestore');
const {google} = require('googleapis');
const compute = google.compute('v1');
const firestore = new Firestore();

exports.checkVMHeartbeatAndRestart = async (req, res) => {
  const vmId = 'YOUR_VM_ID'; // Unique identifier for your VM which you will pass via curl in your cron job
  const projectId = 'YOUR_PROJECT_ID'; // The project ID hosting your VM
  const targetIP = 'YOUR_STATIC_IP'; // The static IP of your VM

  console.log(`Checking heartbeat for VM: ${vmId}`);

  const docRef = firestore.collection('heartbeats').doc(vmId);
  const doc = await docRef.get();

  if (!doc.exists) {
    console.error(`No heartbeat document found for VM: ${vmId}`);
    return res.status(404).send('VM heartbeat document does not exist');
  }

  const {lastHeartbeat} = doc.data();
  const now = Firestore.Timestamp.now();
  const diff = now.seconds - lastHeartbeat.seconds;
  console.log(`Last heartbeat was ${diff} seconds ago for VM: ${vmId}`);

  if (diff <= 120) {
    console.log(`VM: ${vmId} is active.`);
    return res.status(200).send('VM is active.');
  } else {
    console.warn(`VM: ${vmId} is unresponsive. Last heartbeat was ${diff} seconds ago. Initiating restart.`);
    // VM is considered unresponsive; proceed with restart logic
    const auth = await google.auth.getClient({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    let instanceToRestart = null;
    let zoneToRestart = null;

    const zonesResponse = await compute.zones.list({ project: projectId, auth: auth });
    const zones = zonesResponse.data.items.map(zone => zone.name);

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
          break; // Break out of the loop once a match is found
        }
      }

      if (instanceToRestart) {
        break; // Break out of the outer loop if an instance is found
      }
    }

    if (!instanceToRestart) {
      console.error(`No matching instance found for IP: ${targetIP}`);
      return res.status(404).send('No matching instance found');
    }

    // Restart or start the VM
    const request = {
      project: projectId,
      zone: zoneToRestart,
      instance: instanceToRestart,
      auth: auth
    };

    try {
      const instanceDetails = await compute.instances.get(request);
      const status = instanceDetails.data.status;

      if (status === 'RUNNING') {
        console.log(`Instance ${instanceToRestart} is running and will be reset.`);
        await compute.instances.reset(request);
      } else if (status === 'TERMINATED' || status === 'STOPPED') {
        console.log(`Instance ${instanceToRestart} is stopped/terminated and will be started.`);
        await compute.instances.start(request);
      }

      console.log(`Operation completed on VM instance ${instanceToRestart}.`);
      res.status(200).send(`Operation completed on ${instanceToRestart}`);
    } catch (err) {
      console.error(`Error performing operation on VM: ${err}`);
      res.status(500).send('Failed to perform operation on VM');
    }
  }
};
