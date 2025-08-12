import React from 'react';
import {
  Text,
  View,
  StyleSheet,
} from 'react-native';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface VideoInfoProps {
  views?: number;
  createdAt: string;
  style?: any;
  textStyle?: any;
  compact?: boolean;
}

const VideoInfo: React.FC<VideoInfoProps> = ({
  views = 0,
  createdAt,
  style,
  textStyle,
  compact = false
}) => {
  const formatViewCount = (count: number): string => {
    if (!count || isNaN(count)) return '0';
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M';
    } else if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K';
    }
    return String(count);
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = dayjs(dateString);
      return date.fromNow();
    } catch (error) {
      return 'Recently';
    }
  };

  const viewsText = `${formatViewCount(views)} view${views === 1 ? '' : 's'}`;
  const dateText = formatDate(createdAt);

  if (compact) {
    return (
      <View style={[styles.container, style]}>
        <Text style={[styles.infoText, textStyle]}>
          {viewsText} • {dateText}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.infoRow}>
        <Text style={[styles.viewsText, textStyle]}>
          {viewsText}
        </Text>
        <Text style={[styles.separator, textStyle]}>•</Text>
        <Text style={[styles.dateText, textStyle]}>
          {dateText}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 13,
    color: '#B0B0B0',
    fontWeight: '500',
  },
  viewsText: {
    fontSize: 13,
    color: '#B0B0B0',
    fontWeight: '500',
  },
  separator: {
    fontSize: 13,
    color: '#B0B0B0',
    marginHorizontal: 6,
  },
  dateText: {
    fontSize: 13,
    color: '#B0B0B0',
    fontWeight: '500',
  },
});

export default VideoInfo;
