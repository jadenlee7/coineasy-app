import moment from 'moment';
import { Text } from 'react-native';
import { useTailwind } from 'tailwind-rn';

moment.updateLocale('en', {
  relativeTime: {
    s: 'secs.',
    m: '1m',
    mm: '%dm',
    h: '1h',
    hh: '%dh',
    d: '1d',
    dd: '%dd',
    w: '1w',
    ww: '%dw',
    M: '1m',
    MM: '%dm',
  },
});

export default function TimeAgo({ timestamp, style }) {
  const tailwind = useTailwind();
  if(timestamp) {
    const timeAgo = moment(timestamp*1000).fromNow();

    const unixTime = moment.unix(timestamp);
    const now = moment();
    const diff = now.diff(unixTime, 'days')

    return <Text style={[tailwind("text-xs"), style]}>{diff > 30 ? unixTime.format('DD/MM/YYYY') : timeAgo == '1m ago' && diff >= 26 ? diff+'d ago' : timeAgo}</Text>
  } else {
    return null;
  }
}
