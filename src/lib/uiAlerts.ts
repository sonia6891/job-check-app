import { Alert, Platform } from 'react-native';

/** React Native Web 不支援 Alert.alert；保留原生 Dialog，瀏覽器改用標準對話框。 */
export function showMessage(title: string, message = '') {
  if (Platform.OS === 'web') {
    const show = (globalThis as typeof globalThis & { alert?: (text: string) => void }).alert;
    if (typeof show === 'function') show(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

/** 用於破壞性操作，Web 與原生端都必須得到確認才執行。 */
export function confirmAction(title: string, message: string, action: () => void, destructive = false) {
  if (Platform.OS === 'web') {
    const confirm = (globalThis as typeof globalThis & { confirm?: (text: string) => boolean }).confirm;
    if (typeof confirm === 'function' && confirm(`${title}\n\n${message}`)) action();
    return;
  }
  Alert.alert(title, message, [
    { text: '取消', style: 'cancel' },
    { text: '確認', style: destructive ? 'destructive' : 'default', onPress: action }
  ]);
}
