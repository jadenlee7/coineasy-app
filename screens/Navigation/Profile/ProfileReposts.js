import React from 'react';
import { Text, View } from 'react-native';
import { useTailwind } from 'tailwind-rn';

const ProfileReposts = () => {
    const tailwind = useTailwind();

    return (
        <View style={tailwind('bg-slate-50 px-5 py-5 items-center mt-4 mx-6 rounded-md')}>
            <Text style={[tailwind('text-slate-900 text-center'), { fontFamily: 'GmarketBold' }]}>Reposts are coming next.</Text>
            <Text style={[tailwind('text-secondary text-center'), { marginTop: 8, lineHeight: 19 }]}>Reposting is not available in the EasyGo backend yet.</Text>
        </View>
    );
};

export default ProfileReposts;
