// Exact model hardware, not an assumption about a retailer's import channel.
// Checked 2026-10-27: Apple states worldwide eSIM-only for iPhone Duo; US, UK,
// Singapore and mainland-China specifications all explicitly exclude physical SIMs.
// https://www.apple.com/newsroom/2026/09/apple-unveils-iphone-duo/
// https://www.apple.com/uk/iphone-duo/specs/
// https://support.apple.com/zh-cn/148588
export const modelEsimOnly = id => id === 'apple-iphone-duo' ? true : undefined;
