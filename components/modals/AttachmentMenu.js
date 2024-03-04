import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Linking, StyleSheet, Text, TouchableOpacity, View,} from 'react-native';
import { CameraIcon, ImagePickerIcon, OrangeLinkIcon, WhiteCameraIcon } from '../Icons';

import * as MediaLibrary from 'expo-media-library';
import Modal from '../Modal';
import * as Haptics from 'expo-haptics';


export const AttachmentsMenu = (props) => {

    const [listDeviceMedia, setListDeviceMedia] = useState([])

    useEffect(() => {
        checkPermission()
    }, [])

    const checkPermission = async () => {
        const permission = await MediaLibrary.getPermissionsAsync();

        // Detect if you can request this permission again

        if (!permission.canAskAgain || permission.status === "denied") {
            Alert.alert('Permission', 'We need your permission to access your photos', [
                {
                  text: 'Cancel',
                  onPress: () => console.log('Cancel Pressed'),
                  style: 'cancel',
                },
                {text: 'Go to settings', onPress: () => Linking.openSettings()},
            ]);
        } else {
            if (permission.status === "granted") {
                const test = await MediaLibrary.getAssetsAsync()
                const listUri = test.assets.map( e => e.uri)
                setListDeviceMedia([...listUri])
            }else{

            }
        }
    }

    const renderActionAttachment = () => (
        <TouchableOpacity 
            style={{alignItems: 'center',justifyContent: 'center',borderRadius: 20,backgroundColor: '#FF6B17', height: 88,width:88}} 
            onPress={props.onCameraPress}
        >
            {props.isCameraLoading ? (
                <ActivityIndicator size="small" color="white" />
            ) : (
                <WhiteCameraIcon />
            )}
        </TouchableOpacity>
    );

    const renderAttachment = (info) => {
        return(
            <TouchableOpacity 
                onPress={() => {Haptics.selectionAsync();props.onAttachmentSelect(info);props.onDismiss()}} 
                style={{marginLeft: 10}}
            >
                <Image
                    style={{width: 88,height: 88,borderRadius: 20,}}
                    source={{uri: info.item}}
                />
            </TouchableOpacity>
        )
    }

    return (
        <Modal hide={() => {Haptics.selectionAsync();props.onDismiss()}} animateModal={false} type='small'>

            <FlatList
                style={{marginTop: 25,marginLeft: 20,marginBottom: 15,}}
                horizontal={true}
                showsHorizontalScrollIndicator={false}
                data={listDeviceMedia}
                renderItem={renderAttachment}
                ListHeaderComponent={renderActionAttachment}
            />

            <View style={{flexDirection:'row',marginLeft: 10,}}>
                <TouchableOpacity 
                    onPress={() => {Haptics.selectionAsync();props.onSelectPhoto();}} 
                    style={{marginLeft: 10,borderWidth: 1, borderColor: '#FF6B17',borderRadius: 20,height: 88,width: 88, justifyContent: 'center',alignItems: 'center',}}
                >
                    <Image
                        style={{resizeMode:'contain',width:27,}}
                        source={require('../../assets/image_picker.png')}
                    />
                </TouchableOpacity>
                <TouchableOpacity 
                    onPress={() => {Haptics.selectionAsync();props.onSelectFile();}} 
                    style={{marginLeft: 10,borderWidth: 1, borderColor: '#FF6B17',borderRadius: 20,height: 88,width: 88, justifyContent: 'center',alignItems: 'center',}}
                >
                    <Image
                        style={{resizeMode:'contain',width:30,}}
                        source={require('../../assets/link_image.png')}
                    />
                </TouchableOpacity>
            </View>

            {/* <View style={{height: 130,justifyContent: 'space-evenly',borderTopWidth: 1,borderTopColor: '#cccccc', borderBottomWidth: 1, borderBottomColor: '#cccccc',}}>
                <TouchableOpacity 
                    style={{borderRadius: 8,marginVertical: 2,paddingVertical: 10,width:'90%',alignSelf: 'center',}}
                    onPress={() => {Haptics.selectionAsync();props.onSelectPhoto()}}
                >
                    <Text style={{marginLeft: 10,}}>Photo or Video</Text>
                </TouchableOpacity>   
                <TouchableOpacity 
                    style={{borderRadius: 8,marginVertical: 2,paddingVertical: 10,width:'90%',alignSelf: 'center',}}
                    onPress={() => {Haptics.selectionAsync();props.onSelectFile()}}
                >
                    <Text style={{marginLeft: 10,}}>File</Text>
                </TouchableOpacity>   
            </View>

            <View style={{height: 70,alignItems: 'center',justifyContent: 'center',}}>
                <TouchableOpacity onPress={() => {Haptics.selectionAsync();props.onDismiss()}} style={{backgroundColor: '#FF6B17',width: 130,height:40,alignItems: 'center',justifyContent: 'center',borderRadius: 8}}>
                    <Text style={{color:'white',fontWeight: 'bold',}}>Cancel</Text>
                </TouchableOpacity>
            </View> */}
        </Modal>
    );
};

const styles = StyleSheet.create({
  divider: {
    marginBottom: 24,
  },
  attachmentsAction: {
    aspectRatio: 1.0,
    height: '100%',
    marginHorizontal: 8,
  },
});
