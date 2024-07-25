import React, { useState, useContext, useEffect, useCallback, useMemo } from "react";
import { GlobalContext } from "../../contexts/GlobalContext";
import Modal from "../Modal";
import Postbox from "../Postbox";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Dimensions, Platform } from "react-native";
import useStatusBarHeight from "../../hooks/useStatusBarHeight";

export default function PostboxModal() {
    const { hidePostbox, modalPostBoxRef, categoriesVis, setRepost, setReplyTo } = useContext(GlobalContext);

    const snapPoints = useMemo(() => ['100%', '100%'], []);
    const snapPointsAndroid = useMemo(() => ['100%', '100%'], []);

    const statusBarHeight = useStatusBarHeight();

    return(
        <BottomSheetModalProvider>
            <BottomSheetModal
                ref={modalPostBoxRef}
                index={1}
                snapPoints={(Platform.OS == 'ios' || categoriesVis) ? snapPoints : snapPointsAndroid}
                enableContentPanningGesture={false}
                handleIndicatorStyle={{backgroundColor: 'black',}}
                handleStyle={{height: 2,justifyContent: 'center',marginTop: 10,}}
                backdropComponent={(backdropProps) => <BottomSheetBackdrop {...backdropProps} enableTouchThrough={true} />}
                topInset={65 + statusBarHeight}
            >
                <Postbox />
            </BottomSheetModal>
        </BottomSheetModalProvider>
    )
//   return(
//     <Modal hide={() => hidePostbox()} animateModal={false} statusBarTranslucent={true} type='post'>
//       <Postbox />
//     </Modal>
//   )
}
