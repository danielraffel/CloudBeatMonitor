# README for CloudBeatMonitor

## Summary
The `CloudBeatMonitor` project includes two Google Cloud Functions designed to monitor and maintain the health of a virtual machine (VM) in a Tailscale network without needing a proxy. It utilizes Google Cloud Firestore to store the VM's last "heartbeat" and manages VM restarts through Google Cloud Compute Engine when unresponsiveness is detected.

## Description
This project ensures the high availability of a VM by:
1. Regularly receiving a heartbeat from the VM.
2. Restarting the VM if it fails to send a heartbeat within a specified time frame, with safeguards to prevent frequent unnecessary restarts.

It consists of two Cloud Functions:
- `receiveHeartbeat`: Called by the VM's cron job every minute to record a "heartbeat" timestamp in Firestore.
- `checkVMHeartbeatAndRestart`: Triggered every minute by Google Cloud Scheduler to assess the VM's responsiveness based on its last heartbeat. If unresponsive, it restarts the VM, using a `resuscitation` timestamp stored in Firestore to track restart attempts and prevent looping.

## Firebase Setup
To set up the necessary Firestore structure:
1. **Create Collections in Firestore**: Navigate to Firestore in the [Firebase Console](https://console.firebase.google.com/) and create two collections: `heartbeats` and `resuscitation`. Note: Each will have the same data structure.
2. **Heartbeats Collection**: In `heartbeats`, add a document for your VM using its unique identifier (`YOUR_VM_ID`) and include a `lastHeartbeat` field with a timestamp value.
3. **Resuscitation Collection**: Similarly, in `resuscitation`, add a document with the same `YOUR_VM_ID` and a `lastHeartbeat` field. This document tracks the last restart attempt to prevent frequent restarts.
     
## Cloning the Repo and Updating Functions
To deploy these functions, follow these steps:

1. Clone the repository to your local machine.
```git clone https://github.com/danielraffel/CloudBeatMonitor.git```
2. In the `checkVMHeartbeatAndRestart` function update the following placeholders in `index.js`:
   - `YOUR_VM_ID`: Your VM's unique identifier (something unique that you create)
   - `YOUR_PROJECT_ID`: Your Google Cloud project ID (something unique that Google assigns you)
   - `YOUR_STATIC_IP`: The static IP address of your VM 
   
## Deploying Functions
Make sure you have the `gcloud` CLI installed and configured to use your Google Cloud project. Then, deploy the functions to Google Cloud Functions using the `gcloud` command-line tool.

Navigate to the root of the folder and run `sudo sh deploy.sh`

## Set Up the VM Cron Job
To send heartbeats every minute from your VM SSH into it and add this to your cron (note: update the Cloud Function URL for `receiveHeartbeat` and `YOUR_VM_ID`):
```
* * * * * curl -X POST https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/receiveHeartbeat \
-H "Content-Type:application/json" --data '{"vmId":"YOUR_VM_ID"}'
```

## Configuring Google Cloud Scheduler
Set up [Google Cloud Scheduler](https://cloud.google.com/scheduler) to trigger `checkVMHeartbeatAndRestart` every minute. Specify the function's URL as the target and use POST as the HTTP method.
- Go to the Google Cloud Console.
- Navigate to "Cloud Scheduler".
- Click "Create Job".
- Enter a name and frequency for the job using the unix-cron format. To check every minute, you could use `*/1 * * * *`.
- For the target, select "HTTP".
- Enter the URL of the checkVMHeartbeatAndRestart function.
- Set the HTTP method to POST.

## Notes
- Ensure that Google Cloud Functions and Firestore APIs are enabled in your Google Cloud project.
- CloudBeatMonitor is best used on non-critical micro instances and not recommended for critical production environments.
- The stability of the monitored VM is now dependent on the reliability of multiple other services: cloud functions, google scheduler, firebase. 🤕 What could go wrong? 🫠
- Don't confuse the VIM (something unique that you create) with the projectID (something assigned to your project by Google)
- Make sure that if you deploy using the bash script that you update your checkVMHeartbeatAndRestart/index.js file with your config settings
- Make sure you created your Firebase db using the Firebase Console that's linked above (not via the GCP Firestore as that doesn't create the necessary IAM accounts / permissions - crazy but true)

## Conclusion
`CloudBeatMonitor` enhances VM uptime, ensuring accessibility even in restricted network environments like Tailscale. By leveraging cloud-based monitoring and automatic restart mechanisms, it provides a simple yet effective solution for maintaining service availability.
