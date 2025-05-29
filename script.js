console.log("Script is running...");

const ws = new WebSocket(`ws://${location.host}`);
const peer = new RTCPeerConnection();
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const messages = document.getElementById('messages');
const input = document.getElementById('messageInput');

let isInitiator = false;

ws.onopen = () => {
  console.log("WebSocket connected");
  ws.send(JSON.stringify({ type: 'join' }));
};

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    localVideo.srcObject = stream;
    stream.getTracks().forEach(track => peer.addTrack(track, stream));
  }).catch(err => {
    console.error("Camera error:", err);
  });

peer.ontrack = event => {
  remoteVideo.srcObject = event.streams[0];
};

peer.onicecandidate = event => {
  if (event.candidate) {
    ws.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
  }
};

ws.onmessage = async ({ data }) => {
  let textData;
  if (typeof data === 'string') {
    textData = data;
  } else if (data instanceof Blob) {
    textData = await data.text();
  } else if (data instanceof ArrayBuffer) {
    textData = new TextDecoder().decode(data);
  } else {
    console.error("Unknown data type:", data);
    return;
  }

  const msg = JSON.parse(textData);

  if (msg.type === 'init') {
    isInitiator = true;
  }

  if (msg.type === 'offer') {
    await peer.setRemoteDescription(new RTCSessionDescription(msg));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    ws.send(JSON.stringify(answer));
  }

  if (msg.type === 'answer') {
    await peer.setRemoteDescription(new RTCSessionDescription(msg));
  }

  if (msg.type === 'candidate') {
    try {
      await peer.addIceCandidate(msg.candidate);
    } catch (err) {
      console.error("ICE error:", err);
    }
  }

  if (msg.type === 'chat') {
    const div = document.createElement('div');
    div.textContent = msg.text;
    messages.appendChild(div);
  }
};

peer.onnegotiationneeded = async () => {
  if (isInitiator) {
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    ws.send(JSON.stringify(offer));
  }
};

function sendMessage() {
  const text = input.value;
  if (text.trim()) {
    ws.send(JSON.stringify({ type: 'chat', text }));
    const div = document.createElement('div');
    div.textContent = `Me: ${text}`;
    messages.appendChild(div);
    input.value = '';
  }
}
