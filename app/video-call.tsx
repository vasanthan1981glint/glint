import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getDatabase, onValue, ref, set } from 'firebase/database';
import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  mediaDevices,
  MediaStream,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCView,
} from 'react-native-webrtc';

const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export default function VideoCallScreen() {
  const { user } = useLocalSearchParams<{ user: string }>();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isRinging, setIsRinging] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [usingFrontCamera, setUsingFrontCamera] = useState(true);
  const [callTime, setCallTime] = useState(0);
  const [remoteName, setRemoteName] = useState('');
  const [remotePhoto, setRemotePhoto] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null); // ✅ FIXED
  const pc = useRef<RTCPeerConnection | null>(null);
  const db = getDatabase();
  const callId = `call-${user}`;
  const router = useRouter();

  const startCall = async (facing: 'user' | 'environment' = 'user') => {
    const stream = await mediaDevices.getUserMedia({
      video: { facingMode: facing },
      audio: true,
    });

    setLocalStream(stream);
    setVideoOn(true);

    const peer = new RTCPeerConnection(configuration);
    pc.current = peer;

    stream.getTracks().forEach((track) => {
      peer.addTrack(track, stream);
    });

    const remote = new MediaStream();
    setRemoteStream(remote);

    (peer as any).ontrack = (event: any) => {
      if (event.streams[0]) {
        event.streams[0].getTracks().forEach((track: any) => {
          remote.addTrack(track);
        });
        setIsRinging(false);
        timerRef.current = setInterval(() => {
          setCallTime((prev) => prev + 1);
        }, 1000);
      }
    };

    (peer as any).onicecandidate = (event: any) => {
      if (event.candidate) {
        set(ref(db, `${callId}/callerCandidates`), event.candidate.toJSON());
      }
    };

    const offer = await peer.createOffer({});
    await peer.setLocalDescription(offer);
    await set(ref(db, `${callId}/offer`), offer);

    onValue(ref(db, `${callId}/answer`), async (snapshot) => {
      const data = snapshot.val();
      if (data && !peer.remoteDescription) {
        const answerDesc = new RTCSessionDescription(data);
        await peer.setRemoteDescription(answerDesc);
      }
    });

    onValue(ref(db, `${callId}/calleeCandidates`), async (snapshot) => {
      const data = snapshot.val();
      if (data) {
        try {
          const candidate = new RTCIceCandidate(data);
          await peer.addIceCandidate(candidate);
        } catch (e) {
          console.warn('Error adding ICE candidate', e);
        }
      }
    });
  };

  useEffect(() => {
    startCall();

    const userRef = ref(db, `users/${user}`);
    onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRemoteName(data.name || '');
        setRemotePhoto(data.photo || '');
      }
    });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current); // ✅ FIXED
      pc.current?.close();
      pc.current = null;
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

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setVideoOn((prev) => !prev);
    }
  };

  const switchCamera = async () => {
    setUsingFrontCamera((prev) => !prev);
    if (pc.current) {
      pc.current.close();
      pc.current = null;
    }
    startCall(!usingFrontCamera ? 'user' : 'environment');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.videoContainer}>
        {videoOn && localStream ? (
          <RTCView streamURL={localStream.toURL()} style={styles.video} objectFit="cover" />
        ) : (
          <View style={styles.videoOffPlaceholder}>
            <Ionicons name="videocam-off" size={48} color="#999" />
          </View>
        )}
        {remoteStream && (
          <RTCView streamURL={remoteStream.toURL()} style={styles.videoRemote} objectFit="cover" />
        )}
      </View>

      {remoteName !== '' && (
        <View style={styles.remoteHeader}>
          {remotePhoto ? (
            <View style={styles.avatarContainer}>
              <View style={styles.avatarBorder}>
                <Image source={{ uri: remotePhoto }} style={styles.avatarImage} />
              </View>
            </View>
          ) : null}
          <Text style={styles.remoteName}>{remoteName}</Text>
        </View>
      )}

      {!isRinging && (
        <View style={styles.timerBox}>
          <Text style={styles.timerText}>{formatTime(callTime)}</Text>
        </View>
      )}

      {isRinging && (
        <View style={styles.ringingOverlay}>
          <View style={styles.ringingBox}>
            <Ionicons name="call" size={24} color="white" />
            <View style={{ height: 8 }} />
            <Text style={{ color: 'white', fontSize: 18 }}>Calling...</Text>
          </View>
        </View>
      )}

      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlButton} onPress={toggleMic}>
          <Ionicons name={micOn ? 'mic' : 'mic-off'} size={24} color="white" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={toggleVideo}>
          <Ionicons name={videoOn ? 'videocam' : 'videocam-off'} size={24} color="white" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={switchCamera}>
          <Ionicons name="camera-reverse" size={24} color="white" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.endButton} onPress={() => router.back()}>
          <Ionicons name="call" size={28} color="white" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  videoContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  video: { width: '100%', height: '50%' },
  videoRemote: { width: '100%', height: '50%' },
  videoOffPlaceholder: {
    width: '100%',
    height: '50%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },
  controls: {
    position: 'absolute',
    bottom: 40,
    width: '100%',
    alignItems: 'center',
  },
  controlButton: {
    backgroundColor: '#444',
    borderRadius: 24,
    padding: 12,
    marginBottom: 10,
  },
  endButton: {
    backgroundColor: 'red',
    borderRadius: 32,
    padding: 16,
    marginTop: 10,
  },
  ringingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringingBox: {
    backgroundColor: '#222',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  timerBox: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  timerText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  remoteHeader: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  remoteName: {
    color: 'white',
    fontSize: 16,
    marginLeft: 8,
    fontWeight: '600',
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  avatarBorder: {
    borderWidth: 1,
    borderColor: 'white',
    borderRadius: 16,
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
});
