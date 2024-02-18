const {Firestore} = require('@google-cloud/firestore');
const firestore = new Firestore();

exports.receiveHeartbeat = async (req, res) => {
  const vmId = req.body.vmId; // Extract VM ID from the request body
  const docRef = firestore.collection('heartbeats').doc(vmId);

  try {
    await docRef.set({
      lastHeartbeat: Firestore.Timestamp.now()
    }, { merge: true });

    console.log(`Heartbeat received for VM: ${vmId}`);
    res.status(200).send('Heartbeat updated');
  } catch (error) {
    console.error('Error updating heartbeat:', error);
    res.status(500).send('Error updating heartbeat');
  }
};
