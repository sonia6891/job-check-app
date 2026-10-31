/**
 * 用商店價格字串的幣別和小數位數寫出另一個金額。
 * 例如 ("NT$590", 49.2) → "NT$49"、("$19.99", 1.67) → "$1.67"。其他地區的訂閱頁才不會把美元寫成台幣。
 */
export function sameCurrency(priceString: string, amount: number) {
  const number = priceString.match(/\d[\d.,]*/)?.[0];
  if (!number) return '';
  const fraction = number.match(/([.,])(\d{1,2})$/);
  const text = fraction ? amount.toFixed(fraction[2].length).replace('.', fraction[1]) : String(Math.round(amount));
  return priceString.replace(number, text);
}
