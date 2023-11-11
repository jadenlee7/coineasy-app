import React, { useState, useContext, useEffect, useCallback } from "react";
import { GlobalContext } from "../../contexts/GlobalContext";
import Modal from "../Modal";
import Postbox from "../Postbox";
import { KeyboardAvoidingView } from "react-native";

export default function PostboxModal() {
  const { hidePostbox } = useContext(GlobalContext);

  return(
    <Modal hide={() => hidePostbox()} animateModal={false} statusBarTranslucent={true}>
        <KeyboardAvoidingView behavior={"padding"}>
            <Postbox />
        </KeyboardAvoidingView>
    </Modal>
  )
}
