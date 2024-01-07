"use strict";

import heygen_API from "./api.json" assert { type: "json" };

const statusElement = document.querySelector("#status");
const apiKey = heygen_API.apiKey;
const SERVER_URL = heygen_API.serverUrl;

if (apiKey === "YourApiKey" || SERVER_URL === "") {
  alert("Please enter your API key and server URL in the api.json file");
}

let sessionInfo = null;
let peerConnection = null;
let mediaStream = null;

function updateStatus(statusElement, message) {
  statusElement.innerHTML += message + "<br>";
  statusElement.scrollTop = statusElement.scrollHeight;
}

updateStatus(
  statusElement,
  "Please click the new button to create the stream first."
);


function onMessage(event) {
  const message = event.data;
  console.log("Received message:", message);
}

// Create a new WebRTC session when clicking the "New" button
async function createNewSession() {
  updateStatus(statusElement, "Creating new session... please wait");

  const avatar = avatarName.value;
  const voice = voiceID.value;

  // call the new interface to get the server's offer SDP and ICE server to create a new RTCPeerConnection
  sessionInfo = await newSession("high", avatar, voice);
  const { sdp: serverSdp, ice_servers2: iceServers } = sessionInfo;

  // Create a new RTCPeerConnection
  peerConnection = new RTCPeerConnection({ iceServers: iceServers });

  // When ICE candidate is available, send to the server
  peerConnection.onicecandidate = ({ candidate }) => {
    console.log("Received ICE candidate:", candidate);
    if (candidate) {
      handleICE(sessionInfo.session_id, candidate.toJSON());
    }
  };

  // When ICE connection state changes, display the new state
  peerConnection.oniceconnectionstatechange = (event) => {
    updateStatus(
      statusElement,
      `ICE connection state changed to: ${peerConnection.iceConnectionState}`
    );
  };

  // When audio and video streams are received, display them in the video element
  const mediaElement = document.querySelector("#mediaElement");
  peerConnection.ontrack = (event) => {
    console.log("Received the track");
    if (event.track.kind === "audio" || event.track.kind === "video") {
      mediaElement.srcObject = event.streams[0];
    }
  };

    // When receiving a message, display it in the status element
  peerConnection.ondatachannel = (event) => {
    const dataChannel = event.channel;
    dataChannel.onmessage = onMessage;
  };

  navigator.mediaDevices.getUserMedia({ audio: true })
    .then((stream) => {
      const audioTrack = stream.getAudioTracks()[0];
      audioTrack.enabled = false;
      console.log("audio track",audioTrack,audioTrack.getSettings())
      const sender = peerConnection.addTrack(audioTrack, stream);
      mediaStream = stream;

    })
    .catch((error) => {
      console.error('Error accessing microphone:', error);
    });

  // Set server's SDP as remote description
  const remoteDescription = new RTCSessionDescription(serverSdp);
  await peerConnection.setRemoteDescription(remoteDescription);

  updateStatus(statusElement, "Session creation completed");
  updateStatus(
    statusElement,
    "Now.You can click the start button to start the stream"
  );
}

// Start session and display audio and video when clicking the "Start" button
async function startAndDisplaySession() {
  if (!sessionInfo) {
    updateStatus(statusElement, "Please create a connection first");
    return;
  }

  updateStatus(statusElement, "Starting session... please wait");

  // Create and set local SDP description
  const localDescription = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(localDescription);

  // Start session
  await startSession(sessionInfo.session_id, localDescription);
  updateStatus(statusElement, "Session started successfully");
}

const taskInput = document.querySelector("#taskInput");

// When clicking the "Send Task" button, get the content from the input field, then send the tas
async function talkHandler() {
  if (!sessionInfo) {
    updateStatus(statusElement, "Please create a connection first");

    return;
  }
  updateStatus(statusElement, "Sending task... please wait");
  const text = taskInput.value;
  if (text.trim() === "") {
    alert("Please enter a task");
    return;
  }

  const resp = await talk(sessionInfo.session_id, text);

  updateStatus(statusElement, "Task sent successfully");
}

// When clicking the "Send Task" button, get the content from the input field, then send the tas
async function repeatHandler() {
  if (!sessionInfo) {
    updateStatus(statusElement, "Please create a connection first");

    return;
  }
  updateStatus(statusElement, "Sending task... please wait");
  const text = taskInput.value;
  if (text.trim() === "") {
    alert("Please enter a task");
    return;
  }

  const resp = await repeat(sessionInfo.session_id, text);

  updateStatus(statusElement, "Task sent successfully");
}

// when clicking the "Close" button, close the connection
async function closeConnectionHandler() {
  if (!sessionInfo) {
    updateStatus(statusElement, "Please create a connection first");
    return;
  }
  updateStatus(statusElement, "Closing connection... please wait");
  try {
    // Close local connection
    peerConnection.close();
    // Call the close interface
    const resp = await stopSession(sessionInfo.session_id);

    console.log(resp);
  } catch (err) {
    console.error("Failed to close the connection:", err);
  }
  updateStatus(statusElement, "Connection closed successfully");
}

document.querySelector("#newBtn").addEventListener("click", createNewSession);
document
  .querySelector("#startBtn")
  .addEventListener("click", startAndDisplaySession);
document
  .querySelector("#talkBtn")
  .addEventListener("click", talkHandler);
document
  .querySelector("#repeatBtn")
  .addEventListener("click", repeatHandler);
document
  .querySelector("#closeBtn")
  .addEventListener("click", closeConnectionHandler);
document
  .querySelector("#startAudioBtn")
  .addEventListener("click", audioInput);

// new session
async function newSession(quality, avatar_name, voice_id) {
  const response = await fetch(`${SERVER_URL}/v1/realtime.new`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify({ quality, avatar_name, voice: {
      voice_id: voice_id,
    }, }),
  });
  if (response.status === 500) {
    console.error("Server error");
    updateStatus(
      statusElement,
      "Server Error. Please ask the staff if the service has been turned on"
    );

    throw new Error("Server error");
  } else {
    const data = await response.json();
    console.log(data.data);
    return data.data;
  }
}

// start the session
async function startSession(session_id, sdp) {
  const response = await fetch(`${SERVER_URL}/v1/realtime.start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify({ session_id, sdp }),
  });
  if (response.status === 500) {
    console.error("Server error");
    updateStatus(
      statusElement,
      "Server Error. Please ask the staff if the service has been turned on"
    );
    throw new Error("Server error");
  } else {
    const data = await response.json();
    return data.data;
  }
}

// submit the ICE candidate
async function handleICE(session_id, candidate) {
  const response = await fetch(`${SERVER_URL}/v1/realtime.ice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify({ session_id, candidate }),
  });
  if (response.status === 500) {
    console.error("Server error");
    updateStatus(
      statusElement,
      "Server Error. Please ask the staff if the service has been turned on"
    );
    throw new Error("Server error");
  } else {
    const data = await response.json();
    return data;
  }
}

async function talk(session_id, text) {
  const task_type = "talk";
  const response = await fetch(`${SERVER_URL}/v1/realtime.task`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify({ session_id, text, task_type }),
  });
  if (response.status === 500) {
    console.error("Server error");
    updateStatus(
      statusElement,
      "Server Error. Please ask the staff if the service has been turned on"
    );
    throw new Error("Server error");
  } else {
    const data = await response.json();
    return data.data;
  }
}

// repeat the text
async function repeat(session_id, text) {
  const task_type = "repeat";
  const response = await fetch(`${SERVER_URL}/v1/realtime.task`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify({ session_id, text, task_type }),
  });
  if (response.status === 500) {
    console.error("Server error");
    updateStatus(
      statusElement,
      "Server Error. Please ask the staff if the service has been turned on"
    );
    throw new Error("Server error");
  } else {
    const data = await response.json();
    return data.data;
  }
}

// stop session
async function stopSession(session_id) {
  const response = await fetch(`${SERVER_URL}/v1/realtime.stop`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify({ session_id }),
  });
  if (response.status === 500) {
    console.error("Server error");
    updateStatus(statusElement, "Server Error. Please ask the staff for help");
    throw new Error("Server error");
  } else {
    const data = await response.json();
    return data.data;
  }
}



let isAudioStart=false;

async function audioInput() {
    let startAudioBtn = document.querySelector("#startAudioBtn")
    const audioTrack = mediaStream.getAudioTracks()[0];
    if (!isAudioStart) {
        if (audioTrack) {
            // Unmute the audio track
            audioTrack.enabled = true;
        }
        isAudioStart = true;
        startAudioBtn.textContent = 'Stop Audio Input';
    } else {
          if (audioTrack) {
              // Mute the audio track
              audioTrack.enabled = false;
          }
          isAudioStart = false;
          startAudioBtn.textContent = 'Start Audio Input';

    }
}