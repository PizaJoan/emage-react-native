import React, { useEffect, useState, useMemo } from 'react';
import { View, Dimensions } from 'react-native';
import { Layout, useTheme } from '@ui-kitten/components';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import Animated, { SlideInLeft, SlideOutLeft, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Canvas, Image, useImage, useCanvasRef } from '@shopify/react-native-skia';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';

const RNFS = require('react-native-fs');
// TODO: get this out on configfile
const appName = 'Emage';
const appFolder = RNFS.DownloadDirectoryPath + '/' + appName;

import EditorContext from './../lib/editorContext'
import EditorHeader from './../components/headers/editorHeader';

import styles from './../styles/editor.style';

import { getItem } from './../lib/storage';
import { TOOLS } from './../lib/constants/editorTools';

const imageWidth = 300;
const imageHeight = 450;

const { width: screenWidth, height: screenHeight} = Dimensions.get('screen');
const screenMidWidth = screenWidth / 2;
const screenMidHeight = screenHeight / 2;

export default function EditorScreen({ navigation }) {

    const [ imageURL, setImageURL ] = useState('');
    const [ imageConfig, setImageConfig ] = useState(false);
    const theme = useTheme();
    const image = useImage(imageURL);
    const [ state, setState ] = useState({
        activeTool: false,
        history: [],
        updateState: updateState,
        imageWidth: imageWidth,
        imageHeight: imageHeight,
    });

    useEffect(() => {
        
        getItem('actualImage').then(setImageURL).catch(console.log);
        getItem('imageConfig').then(setImageConfig).catch(console.log);

    }, []);

    function updateState(newState) {
        setState(newState);
    }
    const canvasRef = useCanvasRef();
    const scale = useSharedValue(1);
    const prevScale = useSharedValue(1);
    const originX = useSharedValue(0);
    const originY = useSharedValue(0);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const originalScale = useSharedValue(0);
    const editedScale = useSharedValue(1);

    const pinchGesture = useMemo(
        () => Gesture.Pinch()
            .onStart(e => {

                if (prevScale.value !== 1) scale.value = prevScale.value - e.scale;

            })
            .onUpdate(e => {
                scale.value = prevScale.value * e.scale;

            })
            .onEnd(e => {
                if (scale.value < 1) scale.value = withTiming(1, { duration: 250 });
                prevScale.value = scale.value;

            }),
        [ scale, prevScale ]
    );

    const panGesture = useMemo(
        () => Gesture.Pan()
            .minPointers(2)
            .onTouchesDown(e => {
                
                if (e.numberOfTouches < 2) return;

                if (originX.value === 0 && originY.value === 0) {

                    originX.value = (e.allTouches[0].absoluteX + e.allTouches[1].absoluteX) / 2;
                    originY.value = (e.allTouches[0].absoluteY + e.allTouches[1].absoluteY) / 2;
                } else {

                    originX.value = screenMidWidth + translateX.value;
                    originY.value = screenMidHeight + translateY.value;
                }
            })
            .onTouchesMove(e => {

                if (e.numberOfTouches < 2) return;

                translateX.value = screenMidWidth - (e.allTouches[0].absoluteX + e.allTouches[1].absoluteX) / 2;
                translateY.value = screenMidHeight - (e.allTouches[0].absoluteY + e.allTouches[1].absoluteY) / 2;
            }),
        [ originX, originY, translateX, translateY ]
    );

    const doubleTapGesture = useMemo(
        () => Gesture.Tap()
            .numberOfTaps(2)
            .onEnd(() => {
                
                scale.value = withTiming(1, { duration: 250 });
                prevScale.value = 1;

                originX.value = 0;
                originY.value = 0;
                translateX.value = 0;
                translateY.value = 0;

            }),
        [ scale, prevScale, translateX, translateY, originX, originY ]
    );

    const longPressGesture = useMemo(
        () => Gesture.LongPress()
            .minDuration(500)
            .onStart(() => {
                originalScale.value = 1;
                editedScale.value = 0;
            })
            .onEnd(() => {
                originalScale.value = 0;
                editedScale.value = 1;
            }),
        [ originalScale, editedScale ]
    );

    const gestures = Gesture.Simultaneous(pinchGesture, panGesture, doubleTapGesture, longPressGesture);

    const animation = useAnimatedStyle(() => ({
        transform: [
            { translateX: originX.value },
            { translateY: originY.value },
            { translateX: -screenMidWidth },
            { translateY: -screenMidHeight },
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value },
            { translateX: -originX.value },
            { translateY: -originY.value },
            { translateX: screenMidWidth },
            { translateY: screenMidHeight },
            { translateX: -translateX.value },
            { translateY: -translateY.value },
        ]
    }));

    const originalStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: originalScale.value }
        ]
    }));

    const editedStyle = useAnimatedProps(() => ({
        transform: [
            { scale: editedScale.value }
        ]
    }));

    function saveImage() {
        
        const editedImage = canvasRef.current.makeImageSnapshot();
        const bytes = editedImage.encodeToBase64(6, 100);
        console.log(bytes.length);

        RNFS.exists(appFolder).then(exists => {
            
            if (!exists) {

                RNFS.mkdir(appFolder).then(writeImage).catch(err => console.log(err.message, err.code));

            } else {

                writeImage();
            }
        });
        function writeImage() {

            const filePath = appFolder + '/prova.webp';

            RNFS.writeFile(filePath, bytes, 'base64')
                .then(res => {
                    console.log('ress', res)

                    CameraRoll.save(filePath, { type: 'photo' }).then(() => {

                        RNFS.unlink(filePath).then(console.log).catch(console.log);
                    });

                })
                .catch(err => {
                    console.log('errr', err)
                });
        }
    }

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <EditorContext.Provider value={state}>
                <EditorHeader style={styles.bringFront} goBack={() => navigation.goBack()} saveImage={saveImage} />
                <Layout style={{ ...styles.layout, backgroundColor: theme['color-primary-800'] }}>
                    <GestureHandlerRootView>
                        <GestureDetector gesture={gestures}>
                            <Animated.View
                                style={[
                                    { 
                                        width: imageWidth,
                                        height: imageHeight,
                                        marginHorizontal: 10,
                                        top: '10%',
                                    },
                                    animation
                                ]}
                            >
                                <Animated.View style={[{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%'}, originalStyle ]}>
                                    <Canvas style={{ flex: 1 }}>
                                        {
                                            image && (
                                                <Image
                                                    image={image}
                                                    fit='contain'
                                                    x={0}
                                                    y={0}
                                                    width={imageWidth}
                                                    height={imageHeight}
                                                />
                                            )
                                        }
                                    </Canvas>
                                </Animated.View>
                                <Animated.View style={[{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%'}, editedStyle]}>
                                    <Canvas style={{ flex: 1 }} ref={canvasRef}>
                                        {
                                            image && (
                                                <Image
                                                    image={image}
                                                    fit='contain'
                                                    x={0}
                                                    y={0}
                                                    width={imageWidth}
                                                    height={imageHeight}
                                                />
                                            )
                                        }
                                        {
                                            state.history.map(action => {
                                                const Tool = TOOLS.find(({ key }) => key === action.key).Tool;
                                                
                                                return <Tool key={action.key} id={action.key} {...action.data} />
                                            })
                                        }
                                    </Canvas>
                                </Animated.View>
                            </Animated.View>
                        </GestureDetector>
                    </GestureHandlerRootView>
                    <View style={styles.editorMenu}>
                        {
                            state.activeTool ? (
                                <Animated.View
                                    entering={SlideInLeft.duration(100)}
                                    exiting={SlideOutLeft.duration(100)}
                                    style={{
                                        ...styles.toolSettings,
                                        zIndex: 2,
                                        width: screenWidth,
                                        backgroundColor: theme['color-primary-default']
                                    }}
                                >
                                    {
                                        state.history.filter(({ active }) => active).map(action => {

                                            const Submenu = TOOLS.find(({ key }) => key === action.key).Submenu;

                                            return <Submenu key={action.key} style={styles.editorTool} id={action.key} />
                                        })
                                    }
                                </Animated.View>) :
                                null
                        }
                        <ScrollView 
                            horizontal={true}
                            showsHorizontalScrollIndicator={false}
                            bounces={false}
                            overScrollMode={'never'}
                            centerContent={true}
                            style={{
                                ...styles.bringFront,
                                backgroundColor: theme['color-primary-default'],
                                width: screenWidth,
                            }}
                            >
                                {TOOLS.map(({ Menu, key }) => (
                                    <Menu key={key} style={styles.editorTool} id={key} />
                                ))}
                        </ScrollView>
                    </View>
                </Layout>
            </EditorContext.Provider>
        </SafeAreaView>
    );
}