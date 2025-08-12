import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getDatabase, onValue, ref, set } from 'firebase/database';
import React, { useEffect, useRef, useState } from 'react';
import {
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    mediaDevices,
    MediaStream,
    MediaStreamTrack,
    RTCIceCandidate,
    RTCPeerConnection,
    RTCRtpSender,
    RTCSessionDescription,
    RTCView,
} from 'react-native-webrtc';

export default function VideoCall() {
  const { user } = useLocalSearchParams<{ user: string }>();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remoteName, setRemoteName] = useState('');
  const [micOn, setMicOn] = useState(true);
  const [usingFrontCam, setUsingFrontCam] = useState(true);
  const [callTime, setCallTime] = useState(0);
  const pc = useRef<any>(null); // ✅ Fix type errors with `any`
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();
  const db = getDatabase();

  const getCameraStream = async (facing = 'user') => {
    const isFront = facing === 'user';
    const devices = await mediaDevices.enumerateDevices() as any[];
    const videoSourceId = devices.find(
      (device) =>
        device.kind === 'videoinput' &&
        device.facing === (isFront ? 'front' : 'environment')
    )?.deviceId;

    return mediaDevices.getUserMedia({
      audio: true,
      video: {
        facingMode: isFront ? 'user' : 'environment',
        deviceId: videoSourceId,
      },
    });
  };

  const switchCamera = async () => {
    const stream = await getCameraStream(usingFrontCam ? 'environment' : 'user');
    setUsingFrontCam(!usingFrontCam);
    setLocalStream(stream);

    if (pc.current) {
      const senders = pc.current.getSenders();
      const videoSender = senders.find((s: RTCRtpSender) => s.track?.kind === 'video');
      if (videoSender) {
        const newVideoTrack = stream.getVideoTracks()[0];
        videoSender.replaceTrack(newVideoTrack);
      }
    }
  };

  useEffect(() => {
    const callId = `call-${user}`;

    const startCall = async () => {
      const stream = await getCameraStream('user');
      setLocalStream(stream);

      const peer = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      }) as any; // ✅ cast to `any` to fix TypeScript errors
      pc.current = peer;

      stream.getTracks().forEach((track: MediaStreamTrack) => {
        peer.addTrack(track, stream);
      });

      const remote = new MediaStream();
      setRemoteStream(remote);

      peer.ontrack = (event: any) => {
        event.streams[0].getTracks().forEach((track: MediaStreamTrack) => {
          remote.addTrack(track);
        });
        if (!timerRef.current) {
          timerRef.current = setInterval(() => setCallTime((t) => t + 1), 1000);
        }
      };

      peer.onicecandidate = (event: any) => {
        if (event.candidate) {
          set(ref(db, `${callId}/callerCandidates`), event.candidate.toJSON());
        }
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await set(ref(db, `${callId}/offer`), offer);

      onValue(ref(db, `${callId}/answer`), async (snap) => {
        const data = snap.val();
        if (data && !peer.remoteDescription) {
          await peer.setRemoteDescription(new RTCSessionDescription(data));
        }
      });

      onValue(ref(db, `${callId}/calleeCandidates`), async (snap) => {
        const data = snap.val();
        if (data) {
          try {
            await peer.addIceCandidate(new RTCIceCandidate(data));
          } catch (err) {
            console.warn('ICE error', err);
          }
        }
      });
    };

    startCall();

    const userRef = ref(db, `users/${user}`);
    onValue(userRef, (snap) => {
      const d = snap.val();
      if (d) {
        setRemoteName(d.name || '');
      }
    });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      pc.current?.close();
    };
  }, []);

  const toggleMic = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setMicOn((prev) => !prev);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {remoteStream && (
        <RTCView streamURL={remoteStream.toURL()} style={styles.remote} objectFit="cover" />
      )}
      {localStream && (
        <RTCView streamURL={localStream.toURL()} style={styles.local} objectFit="cover" />
      )}

      <View style={styles.topBar}>
        <TouchableOpacity onPress={switchCamera} style={styles.iconBtn}>
          <Ionicons name={usingFrontCam ? 'camera-reverse' : 'close'} size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.titleCenter}>
          <Text style={styles.name}>{remoteName || 'User'}</Text>
          <Text style={styles.status}>Calling...</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.grayBtn}>
          <Ionicons name="videocam-off" size={22} color="white" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.grayBtn}>
          <Ionicons name="volume-high" size={22} color="white" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.grayBtn} onPress={toggleMic}>
          <Ionicons name={micOn ? 'mic' : 'mic-off'} size={22} color="white" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.endBtn} onPress={() => router.back()}>
          <Ionicons name="call" size={26} color="white" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
    paddingTop: Platform.OS === 'android' ? 25 : 0,
  },
  remote: {
    flex: 1,
  },
  local: {
    position: 'absolute',
    top: 80,
    right: 16,
    width: 100,
    height: 140,
    borderRadius: 12,
    borderColor: 'white',
    borderWidth: 1,
  },
  topBar: {
    position: 'absolute',
    top: 40,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
  },
  titleCenter: {
    alignItems: 'center',
    flex: 1,
  },
  name: { color: 'white', fontSize: 16, fontWeight: '600' },
  status: { fontSize: 13, color: '#ccc' },
  controls: {
    position: 'absolute',
    bottom: 40,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  grayBtn: {
    backgroundColor: '#444',
    padding: 16,
    borderRadius: 40,
  },
  endBtn: {
    backgroundColor: 'red',
    padding: 16,
    borderRadius: 40,
  },
});
