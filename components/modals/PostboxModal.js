import React, { useState, useContext, useEffect, useCallback } from "react";
import { GlobalContext } from "../../contexts/GlobalContext";
import Modal from "../Modal";
import Postbox from "../Postbox";

export default function PostboxModal() {
  const { hidePostbox } = useContext(GlobalContext);

  return(
    <Modal hide={() => hidePostbox()} animateModal={false} statusBarTranslucent={true}>
      <Postbox />
    </Modal>
  )
}
