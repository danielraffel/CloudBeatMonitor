#!/bin/bash

# Before running this you must manually update: YOUR_PROJECT_ID, YOUR_VM_ID and YOUR_STATIC_IP in checkVMHeartbeatAndRestart/index.js 

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
