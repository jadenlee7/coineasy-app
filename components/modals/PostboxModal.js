import React, {
    useState,
    useContext,
    useCallback,
    useImperativeHandle,
    useLayoutEffect,
    useMemo,
    useRef,
} from "react";
import { GlobalContext } from "../../contexts/GlobalContext";
import Postbox, { createPostboxComposeTarget, postboxComposeTargetKey } from "../Postbox";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Platform } from "react-native";
import useStatusBarHeight from "../../hooks/useStatusBarHeight";

export default function PostboxModal() {
    const {
        categoriesVis,
        editedPost,
        modalPostBoxRef,
        replyTo,
        repost,
    } = useContext(GlobalContext);
    const [openGeneration, setOpenGeneration] = useState(0);
    const modalSheetRef = useRef(null);
    const liveOpenGenerationRef = useRef(0);
    const pendingPresentGenerationRef = useRef(null);

    const snapPoints = useMemo(() => ['100%', '100%'], []);
    const snapPointsAndroid = useMemo(() => ['100%', '100%'], []);

    const statusBarHeight = useStatusBarHeight();
    const composeTarget = createPostboxComposeTarget({
        editedPost,
        openGeneration,
        replyTo,
        repost,
    });
    const composeKey = postboxComposeTargetKey(composeTarget);

    const preparePresent = useCallback(() => {
        const nextGeneration = liveOpenGenerationRef.current + 1;
        liveOpenGenerationRef.current = nextGeneration;
        pendingPresentGenerationRef.current = nextGeneration;
        setOpenGeneration(nextGeneration);
    }, []);

    const close = useCallback(() => {
        pendingPresentGenerationRef.current = null;
        modalSheetRef.current?.close();
    }, []);

    useImperativeHandle(modalPostBoxRef, () => ({
        present: preparePresent,
        close,
    }), [close, modalPostBoxRef, preparePresent]);

    useLayoutEffect(() => {
        if (pendingPresentGenerationRef.current !== openGeneration) return;
        pendingPresentGenerationRef.current = null;
        modalSheetRef.current?.present();
    }, [openGeneration]);

    return(
        <BottomSheetModalProvider>
            <BottomSheetModal
                ref={modalSheetRef}
                index={1}
                snapPoints={(Platform.OS == 'ios' || categoriesVis) ? snapPoints : snapPointsAndroid}
                enableContentPanningGesture={false}
                handleIndicatorStyle={{backgroundColor: 'black',}}
                handleStyle={{height: 2,justifyContent: 'center',marginTop: 10,}}
                backdropComponent={(backdropProps) => <BottomSheetBackdrop {...backdropProps} enableTouchThrough={true} />}
                topInset={65 + statusBarHeight}
            >
                <Postbox key={composeKey} openGeneration={openGeneration} />
            </BottomSheetModal>
        </BottomSheetModalProvider>
    )
//   return(
//     <Modal hide={() => hidePostbox()} animateModal={false} statusBarTranslucent={true} type='post'>
//       <Postbox />
//     </Modal>
//   )
}
