# README for tailscale-monitor-restart

## Summary
The `tailscale-monitor-restart` project contains two Google Cloud Functions that work together to monitor and maintain the health of a virtual machine (VM) running in a Tailscale network. The functions leverage Google Cloud Firestore for tracking the VM's "heartbeat" and Google Cloud Compute Engine for restarting the VM if it becomes unresponsive.

## Description
This project aims to ensure high availability of a VM by:

1. Regularly receiving a heartbeat from the VM.
2. Checking the last received heartbeat and restarting the VM if it has not sent a heartbeat in over 2 minutes.

The system consists of two separate Cloud Functions:

- `receiveHeartbeat`: This function is called by a cron job running every minute on the VM. It records the current time as a "heartbeat" in a Firestore document.
- `checkVMHeartbeatAndRestart`: Triggered by Google Cloud Scheduler every minute, this function checks the last heartbeat time. If the last heartbeat is older than 2 minutes, it initiates a restart of the VM through Google Cloud Compute Engine.

## Firebase Setup
Create a [Firestore database](https://console.cloud.google.com/firestore/databases) within your Google Cloud project. Set up the following:
- Go to the Firebase Console.
- Select your project.
- Navigate to the Firestore Database section.
- Start a collection named `heartbeats`.
- Within this collection, add a document with the Document ID containing the name of your `YOUR_VM_ID` (eg a unique identifier for your VM which you will pass via curl in your cron job)
- Add a field named `lastHeartbeat` with a `timestamp` value.

## What Needs to be Updated
1. In the checkVMHeartbeatAndRestart Cloud Funcation navigate to `index.js`, update the placeholder data:
   - `YOUR_VM_ID`: Replace with a unique identifier of your own creation for your VM, this something that should only be known to you.
   - `YOUR_PROJECT_ID`: Replace with your Google Cloud project ID.
   - `YOUR_STATIC_IP`: Replace with the static external IP address of your VM.

2. In your VM's cron job, update the URL to point to the deployed `receiveHeartbeat` function.

## Creating the Cron Job on the VM
Set up a cron job on your VM to send the heartbeat to receiveHeartbeat by adding the following line to your crontab - be certain to update a) the URL to contain the b) region for the receiveHeartbeat cloud function and c) Project ID d) YOUR_VM_ID

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

# Set your project ID and other configuration details
YOUR_PROJECT_ID="YOUR_PROJECT_ID"
YOUR_VM_ID="YOUR_VM_ID"
YOUR_STATIC_IP="YOUR_STATIC_IP"

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

## Note
- Ensure that Google Cloud Functions and Firestore APIs are enabled in your Google Cloud project.

## Conclusion
With the `tailscale-monitor-restart` project, you can maintain the uptime of your VM, reduce downtime, and ensure that your services remain accessible to your users. This project is particularly useful in scenarios where direct network access to the VM might be restricted due to it being on a Tailscale network.
