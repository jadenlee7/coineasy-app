import React, { useContext, useState, useEffect } from "react";
import { View, ActivityIndicator, ScrollView } from 'react-native';
import Pane from "../Pane";
import ProfileDetails from "../ProfileDetails";
import { GlobalContext } from "../../contexts/GlobalContext";
import { useTailwind } from 'tailwind-rn';
import SecondHeader from "../SecondHeader";

export default function PostPane({did}) {
  const { user, orbis, showConnectModal, setShowConnectModal, postDetailsVis } = useContext(GlobalContext);
  const tailwind = useTailwind();
  const [ profile, setProfile ] = useState();

  useEffect(() => {
    getProfile();
  }, [did]);

  async function getProfile() {
    const { data, error } = await orbis.getProfile(did);
    setProfile(data);
  }

  return(
    <Pane>
      <SecondHeader label="" showBack={true} />
      {profile &&
        <ProfileDetails profile={profile?.details} pfpMarginTop={-10} />
      }
    </Pane>
  )
}
