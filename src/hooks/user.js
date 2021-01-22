import React, {
    createContext,
    useCallback,
    useState,
    useEffect,
    useContext,
} from 'react'
import { PermissionsAndroid, Platform } from 'react-native'
import AsyncStorage from '@react-native-community/async-storage'
import Geolocation from 'react-native-geolocation-service'
import OneSignal from 'react-native-onesignal'
import RNSecureStorage, { ACCESSIBLE } from 'rn-secure-storage'
import SplashScreen from 'react-native-splash-screen'

import translate from '../../locales/i18n'
import { authUser } from '../api/user'

const UserContext = createContext(null)

export const UserProvider = ({ children }) => {
    const [token, setToken] = useState('')
    const [data, setData] = useState({})
    const [avatar, setAvatar] = useState('')
    const [households, setHouseholds] = useState([{}])
    const [householdAvatars, setHouseholdAvatars] = useState({})
    const [selected, setSelected] = useState({})
    const [surveys, setSurveys] = useState([{}])
    const [location, setLocation] = useState({})
    const [app, setApp] = useState({})
    const [score, setScore] = useState(0)
    const [lastReport, setLastReport] = useState('')

    const [isLoggedIn, setIsLoggedIn] = useState(true)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        loadStoredData()
    }, [])

    const loadStoredData = useCallback(async () => {
        const userData = JSON.parse(
            await AsyncStorage.getItem('userData')
        )

        const selectedData = JSON.parse(
            await AsyncStorage.getItem('selectedData')
        )

        if (userData) {
            setData(userData)
        }
        if (selectedData) {
            setSelected(selectedData)
        }

        SplashScreen.hide()
        setIsLoading(false)
    }, [])

    const loadSecondaryData = useCallback(async () => {
        let email = ''
        let password = ''

        RNSecureStorage.get('userEmail').then((data) => {
            email = data
        }).catch((err) => {
            console.log(err)
        })

        RNSecureStorage.get('userPwd').then((data) => {
            password = data
        }).catch((err) => {
            console.log(err)
        })

        const avatar = await AsyncStorage.getItem('userAvatar')
        const score = parseInt(await AsyncStorage.getItem('userScore'))
        const lastReport = await AsyncStorage.getItem('lastReport')

        const householdAvatars = JSON.parse(
            await AsyncStorage.getItem('householdAvatars')
        )

        if (email === '' || password === '') {
            signOut()
        }
        if (avatar) {
            setAvatar(avatar)
        }
        if (score) {
            setScore(score)
        }
        if (lastReport) {
            setLastReport(lastReport)
        }
        if (householdAvatars) {
            setHouseholdAvatars(householdAvatars)
        }

        await signIn({ email, password })
    }, [])

    const storeUserData = async (user, token) => {
        const households = user.households
        const app = user.app

        setToken(token)
        setHouseholds(households)
        setApp(app)

        user.households = undefined
        user.app = undefined

        setData(user)

        await AsyncStorage.setItem(
            'userData',
            JSON.stringify(user)
        )
    }

    const sendUserTagsToOneSignal = (user) => {
        const userGroup = user.group ? user.group.split('/')[3] : null
        const userSchool = user.school_unit_id ? user.school_unit_id.toString() : null

        OneSignal.setExternalUserId(user.id.toString())
        OneSignal.sendTags({
            city: user.city,
            group: userGroup,
            school_unit_id: userSchool,
            platform: Platform.OS,
            platform_version: Platform.Version.toString(),
        })
    }

    const signIn = useCallback(async ({ email, password }) => {
        const response = await authUser({
            email,
            password,
        })

        if (response.status === 200) {
            storeUserData(response.body.user, response.token)
            sendUserTagsToOneSignal(response.body.user)
        }
        else if (response.status === 401) {
            signOut()
        }
        else {
            setIsLoggedIn(false)
        }
    }, [])

    const removeUserTagsfromOneSignal = () => {
        OneSignal.removeExternalUserId()
        OneSignal.deleteTag('city')
        OneSignal.deleteTag('group')
        OneSignal.deleteTag('school_unit_id')
        OneSignal.deleteTag('score')
    }

    const signOut = () => {
        AsyncStorage.multiRemove([
            'userData',
            //'userScore',
            //'userAvatar',
            'selectedData',
            'householdAvatars',
            //'lastReport',
        ])

        RNSecureStorage.remove('userEmail')
        RNSecureStorage.remove('userPwd')

        removeUserTagsfromOneSignal()
        setIsLoggedIn(false)
    }

    const selectUser = async (person) => {
        if (person.description) {
            // Is a household
            person.user = undefined

            setSelected(person)
            await AsyncStorage.setItem(
                'selectedData',
                JSON.stringify(person)
            )
        } else {
            setSelected({})
            await AsyncStorage.removeItem('selectedData')
        }
    }

    const getCurrentUserInfo = () => {
        if (selected.description) {
            // Is a household
            return {
                ...selected,
                is_household: true,
                name: selected.description,
                description: undefined,
                avatar: householdAvatars[selected.id],
            }
        } else {
            return {
                ...data,
                is_household: false,
                name: data.user_name,
                user_name: undefined,
                avatar: avatar,
            }
        }
    }

    const storeHouseholds = (households) => {
        setHouseholds(households)
    }

    const updateHouseholdAvatars = async (id, source) => {
        const newAvatars = { ...householdAvatars, [id]: source }
        setHouseholdAvatars(newAvatars)

        await AsyncStorage.setItem(
            'householdAvatars',
            JSON.stringify(newAvatars)
        )
    }

    const storeSurveys = (surveys) => {
        setSurveys(surveys)
    }

    const updateUserScore = async () => {
        const lastReportDate = new Date(lastReport)
        const todayDate = new Date()

        const daysDiff = Math.floor(
            (todayDate.getTime() - lastReportDate.getTime())
            / (1000 * 60 * 60 * 24)
        )

        switch (daysDiff) {
            case 0:
                console.warn('Already reported today')
                break
            case 1:
                setScore(score + 1)
                setLastReport(todayDate.toString())
                console.warn('Reported the day before')
                
                await AsyncStorage.setItem('userScore', score.toString())
                await AsyncStorage.setItem('lastReport', todayDate.toString())
                break
            default:
                setScore(0)
                setLastReport(todayDate.toString())
                console.warn('Did not report the day before')
                
                await AsyncStorage.setItem('userScore', score.toString())
                await AsyncStorage.setItem('lastReport', todayDate.toString())
        }

        OneSignal.sendTags({ score })
        console.warn(`User score: ${score}`)
    }

    const getCurrentLocation = async () => {
        try {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                {
                    title: translate('locationRequest.permissionTitle'),
                    message:
                        translate('locationRequest.permissionMessage') +
                        translate('locationRequest.permissionMessage2'),
                    buttonNegative: translate('locationRequest.cancelText'),
                    buttonPositive: translate('locationRequest.okText'),
                }
            )

            if (Platform.OS === 'android') {
                if (granted === PermissionsAndroid.RESULTS.GRANTED) {
                    console.log('Location permission granted')
                } else {
                    console.log('Location permission denied')
                }
            }
        } catch (err) {
            console.warn(err)
        }

        Geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    error: 0,
                })
            },
            (error) => {
                setLocation({
                    latitude: 0,
                    longitude: 0,
                    error: error.code,
                })
            },
            {
                enableHighAccuracy: true,
                timeout: 50000,
            }
        )
    }

    return (
        <UserContext.Provider
            value={{
                signIn,
                signOut,
                token,
                data,
                loadSecondaryData,
                selectUser,
                getCurrentUserInfo,
                avatar,
                households,
                storeHouseholds,
                householdAvatars,
                updateHouseholdAvatars,
                surveys,
                storeSurveys,
                updateUserScore,
                location,
                getCurrentLocation,
                app,
                lastReport,
                score,
                isLoading,
                isLoggedIn,
            }}
        >
            {children}
        </UserContext.Provider>
    )
}

export function useUser() {
    const context = useContext(UserContext)

    if (!context) {
        throw new Error('useUser must be used within an UserProvider')
    }

    return context
}