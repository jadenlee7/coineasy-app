import React from 'react';
import { Text, View } from 'react-native';
import { useTailwind } from 'tailwind-rn';

const ProfileReplies = () => {
    const tailwind = useTailwind();

    return (
        <View style={tailwind('bg-slate-50 px-5 py-5 items-center mt-4 mx-6 rounded-md')}>
            <Text style={[tailwind('text-slate-900 text-center'), { fontFamily: 'GmarketBold' }]}>Replies are coming next.</Text>
            <Text style={[tailwind('text-secondary text-center'), { marginTop: 8, lineHeight: 19 }]}>The EasyGo API does not expose an authored-replies timeline yet.</Text>
        </View>
    );
};

export default ProfileReplies;
