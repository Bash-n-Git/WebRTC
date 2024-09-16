import './style.css';

// Import the necessary Firebase functions
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, addDoc, setDoc, getDoc, onSnapshot } from "firebase/firestore";

// Your Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCNPBQMvuyLWh1046mGYFe_gileFxRGxrQ",
    authDomain: "test-8b02a.firebaseapp.com",
    projectId: "test-8b02a",
    storageBucket: "test-8b02a.appspot.com",
    messagingSenderId: "801625822027",
    appId: "1:801625822027:web:30bf4ab2ab1614cf3b0ece",
    measurementId: "G-ENGM3244GB"
  };
  

 
  
  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const firestore = getFirestore(app);
  
  const servers = {
    iceServers: [
      {
        urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
      },
    ],
    iceCandidatePoolSize: 10,
  };
  
  // Global State
  let pc = new RTCPeerConnection(servers);
  let localStream = null;
  let remoteStream = new MediaStream();
  
  window.onload = () => {
    const webcamButton = document.getElementById('webcamButton');
    const webcamVideo = document.getElementById('webcamVideo');
    const callButton = document.getElementById('callButton');
    const callInput = document.getElementById('callInput');
    const answerButton = document.getElementById('answerButton');
    const remoteVideo = document.getElementById('remoteVideo');
    const hangupButton = document.getElementById('hangupButton');
  
    // 1. Setup media sources
    webcamButton.onclick = async () => {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  
        // Add the local stream to the peer connection
        localStream.getTracks().forEach(track => {
          pc.addTrack(track, localStream);
        });
  
        webcamVideo.srcObject = localStream;
  
        // Handle remote stream
        pc.ontrack = (event) => {
          event.streams[0].getTracks().forEach(track => {
            remoteStream.addTrack(track);
          });
          remoteVideo.srcObject = remoteStream;
        };
  
        // Enable call/answer buttons
        callButton.disabled = false;
        answerButton.disabled = false;
        webcamButton.disabled = true;
      } catch (error) {
        console.error('Error accessing media devices.', error);
      }
    };
  
    // 2. Create an offer
    callButton.onclick = async () => {
      const callDoc = doc(collection(firestore, 'calls'));
      const offerCandidates = collection(callDoc, 'offerCandidates');
      const answerCandidates = collection(callDoc, 'answerCandidates');
  
      callInput.value = callDoc.id;
  
      // Get ICE candidates for the caller, save to Firestore
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addDoc(offerCandidates, event.candidate.toJSON());
        }
      };
  
      // Create offer
      const offerDescription = await pc.createOffer();
      await pc.setLocalDescription(offerDescription);
  
      const offer = {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
      };
  
      await setDoc(callDoc, { offer });
  
      // Listen for remote answer
      onSnapshot(callDoc, (snapshot) => {
        const data = snapshot.data();
        if (!pc.currentRemoteDescription && data?.answer) {
          const answerDescription = new RTCSessionDescription(data.answer);
          pc.setRemoteDescription(answerDescription);
        }
      });
  
      // When answered, add ICE candidates to the peer connection
      onSnapshot(answerCandidates, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const candidate = new RTCIceCandidate(change.doc.data());
            pc.addIceCandidate(candidate);
          }
        });
      });
  
      hangupButton.disabled = false;
    };
  
    // 3. Answer the call with the unique ID
    answerButton.onclick = async () => {
      const callId = callInput.value;
      const callDoc = doc(firestore, 'calls', callId);
      const answerCandidates = collection(callDoc, 'answerCandidates');
      const offerCandidates = collection(callDoc, 'offerCandidates');
  
      // Get ICE candidates for the caller, save to Firestore
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addDoc(answerCandidates, event.candidate.toJSON());
        }
      };
  
      const callData = (await getDoc(callDoc)).data();
  
      const offerDescription = callData.offer;
      await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));
  
      const answerDescription = await pc.createAnswer();
      await pc.setLocalDescription(answerDescription);
  
      const answer = {
        type: answerDescription.type,
        sdp: answerDescription.sdp,
      };
  
      await setDoc(callDoc, { answer }, { merge: true });
  
      // Listen for remote ICE candidates
      onSnapshot(offerCandidates, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            let data = change.doc.data();
            pc.addIceCandidate(new RTCIceCandidate(data));
          }
        });
      });
    };
  
    // 4. Hangup the call
    hangupButton.onclick = () => {
      pc.close();
      pc = new RTCPeerConnection(servers);
      remoteStream = new MediaStream();
      webcamButton.disabled = false;
      callButton.disabled = true;
      answerButton.disabled = true;
      hangupButton.disabled = true;
    };
  };
  