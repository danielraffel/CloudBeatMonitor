# README for CloudBeatMonitor

## Summary
The `CloudBeatMonitor` project contains two Google Cloud Functions that work together to monitor and maintain the health of a virtual machine (VM). It was created as a simple way to monitor a VM running in a private Tailscale network without using a proxy. The functions leverage Google Cloud Firestore for storing the VM's last "heartbeat" and Google Cloud Compute Engine for restarting the VM if it becomes unresponsive.

## Description
This project aims to ensure high availability of a VM by:

1. Regularly receiving a heartbeat from the VM.
2. Checking the last received heartbeat and restarting the VM if it has not sent a heartbeat in over 2 minutes.

The system consists of two separate Cloud Functions:

- `receiveHeartbeat`: This function is called by a cron job running every minute on the VM. It records the current time as a "heartbeat" in a Firestore document.
- `checkVMHeartbeatAndRestart`: Triggered by Google Cloud Scheduler job every minute, this function checks the last heartbeat time. If the last heartbeat is older than 2 minutes, it initiates a restart of the VM through Google Cloud Compute Engine.

## Firebase Setup
Create a [Firestore database](https://console.firebase.google.com/) and set up the following:
- Go to the Firebase Console. Note: You will be creating two collections. One is named heartbeats and the other is named resuscitation.
- Select your project.
- Navigate to the Firestore Database section.
- Create your first collection named `heartbeats`.
- Within this collection, add a document with the Document ID containing the name of your `YOUR_VM_ID` (eg a unique identifier for your VM which you will pass via curl in your cron job)
- Add a field named `lastHeartbeat` with a `timestamp` value.
- Create your second collection named `resuscitation`.
- Within this collection, also add a document with the Document ID containing the name of your `YOUR_VM_ID` (eg a unique identifier for your VM which you will pass via curl in your cron job)
- Add a field named `lastHeartbeat` with a `timestamp` value.

## What Needs to be Updated
1. In the checkVMHeartbeatAndRestart Cloud Funcation navigate to `index.js`, update the placeholder data:
   - `YOUR_VM_ID`: Replace with a unique identifier of your own creation for your VM, this something that should only be known to you.
   - `YOUR_PROJECT_ID`: Replace with your Google Cloud project ID.
   - `YOUR_STATIC_IP`: Replace with the static external IP address of your VM.

2. In your VM's cron job, update the URL to point to the deployed `receiveHeartbeat` function.

## Creating the Cron Job on the VM
Set up a cron job on your VM to send the heartbeat to receiveHeartbeat by adding the following line to your crontab - be certain to update the cloud function URL to contain a) your region for the receiveHeartbeat cloud function b) your Project ID c) YOUR_VM_ID

```
* * * * * curl -X POST https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/receiveHeartbeat \
-H "Content-Type:application/json" --data '{"vmId":"YOUR_VM_ID"}'
```

## Setting Up Google Cloud Scheduler
To set up [Google Cloud Scheduler](https://cloud.google.com/scheduler):
- Go to the Google Cloud Console.
- Navigate to "Cloud Scheduler".
- Click "Create Job".
- Enter a name and frequency for the job using the unix-cron format. To check every minute, you could use `*/1 * * * *`.
- For the target, select "HTTP".
- Enter the URL of the checkVMHeartbeatAndRestart function.
- Set the HTTP method to POST.

## Cloning the Repo and Deploying Functions
To deploy these functions, follow these steps:

1. Clone the repository to your local machine.
2. Navigate to each function's directory.
3. Deploy each function to Google Cloud Functions using the `gcloud` command-line tool.

Here is an example script to consider running to deploy the Cloud Functions:

```bash
#!/bin/bash

# MANUALLY UPDATE your project ID and other configuration details in checkVMHeartbeatAndRestart/index.js 
# YOUR_PROJECT_ID="YOUR_PROJECT_ID"
# YOUR_VM_ID="YOUR_VM_ID"
# YOUR_STATIC_IP="YOUR_STATIC_IP"

# Deploy the receiveHeartbeat function
gcloud functions deploy receiveHeartbeat \
  --runtime nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --source ./receiveHeartbeat \
  --entry-point receiveHeartbeat \
  --project $YOUR_PROJECT_ID

# Deploy the checkVMHeartbeatAndRestart function
gcloud functions deploy checkVMHeartbeatAndRestart \
  --runtime nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --source ./checkVMHeartbeatAndRestart \
  --entry-point checkVMHeartbeatAndRestart \
  --project $YOUR_PROJECT_ID
```

Make sure you have the `gcloud` CLI installed and configured to use your Google Cloud project.

## Notes
- Ensure that Google Cloud Functions and Firestore APIs are enabled in your Google Cloud project.
- CloudBeatMonitor is best used on non-critical micro instances and not recommended for critical production environments.
- The stability of the monitored VM is now dependent on the reliability of multiple other services: cloud functions, google scheduler, firebase. 🤕 What could go wrong? 🫠
- Don't confuse the VIM (something unique that you create) with the projectID (something assigned to your project by Google)
- Make sure that if you deploy using the bash script that you update your checkVMHeartbeatAndRestart/index.js file with your config settings
- Make sure you created your Firebase db using the Firebase Console that's linked above (not via the GCP Firestore as that doesn't create the necessary IAM accounts / permissions - crazy but true)

## Conclusion
With the `CloudBeatMonitor` project, you can maintain the uptime of your VM, reduce downtime, and ensure that your services remain accessible. This project is particularly useful in scenarios where direct network access to the VM might be restricted due to it being on a Tailscale network.
