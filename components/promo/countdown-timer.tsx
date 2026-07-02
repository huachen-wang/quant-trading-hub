import { useEffect, useState } from "react";
import { Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

type TimeLeft = {
  days: number;
  hours: number;
  mins: number;
  secs: number;
  ended: boolean;
};

type CountdownTimerProps = {
  endTime: string;
  large?: boolean;
  styles: {
    countdownEnded: StyleProp<TextStyle>;
    countdownRow: StyleProp<ViewStyle>;
    countdownBlock: StyleProp<ViewStyle>;
    countdownBlockLg: StyleProp<ViewStyle>;
    countdownNum: StyleProp<TextStyle>;
    countdownSep: StyleProp<TextStyle>;
  };
};

function getTimeLeft(endTime: string): TimeLeft {
  const diff = new Date(endTime).getTime() - Date.now();
  if (!Number.isFinite(diff) || diff <= 0) {
    return { days: 0, hours: 0, mins: 0, secs: 0, ended: true };
  }
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    mins: Math.floor((diff % 3600000) / 60000),
    secs: Math.floor((diff % 60000) / 1000),
    ended: false,
  };
}

export function CountdownTimer({ endTime, large, styles }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => getTimeLeft(endTime));

  useEffect(() => {
    setTimeLeft(getTimeLeft(endTime));
    const timer = setInterval(() => {
      const next = getTimeLeft(endTime);
      setTimeLeft(next);
      if (next.ended) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [endTime]);

  if (timeLeft.ended) {
    return <Text style={[styles.countdownEnded, large && { fontSize: 14 }]}>已结束</Text>;
  }

  return (
    <View style={[styles.countdownRow, large && { gap: 6 }]}>
      {timeLeft.days > 0 && (
        <>
          <View style={[styles.countdownBlock, large && styles.countdownBlockLg]}>
            <Text style={[styles.countdownNum, large && { fontSize: 16 }]}>{timeLeft.days}</Text>
          </View>
          <Text style={styles.countdownSep}>天</Text>
        </>
      )}
      <View style={[styles.countdownBlock, large && styles.countdownBlockLg]}>
        <Text style={[styles.countdownNum, large && { fontSize: 16 }]}>{String(timeLeft.hours).padStart(2, "0")}</Text>
      </View>
      <Text style={styles.countdownSep}>:</Text>
      <View style={[styles.countdownBlock, large && styles.countdownBlockLg]}>
        <Text style={[styles.countdownNum, large && { fontSize: 16 }]}>{String(timeLeft.mins).padStart(2, "0")}</Text>
      </View>
      <Text style={styles.countdownSep}>:</Text>
      <View style={[styles.countdownBlock, large && styles.countdownBlockLg]}>
        <Text style={[styles.countdownNum, large && { fontSize: 16 }]}>{String(timeLeft.secs).padStart(2, "0")}</Text>
      </View>
    </View>
  );
}
