import React from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'

import Spinner from 'react-native-spinkit'

import { Screen } from './styles'
import { scale } from '../../utils/scallingUtils'

const ScreenLoader = () => {
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#348EAC' }}>
            <Screen>
                <Spinner type='ThreeBounce' size={scale(72)} color='#348EAC' />
            </Screen>
        </SafeAreaView>
    )
}

export default ScreenLoader