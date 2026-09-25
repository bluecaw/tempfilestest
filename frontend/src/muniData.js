// メモリ上にデータを保持するキャッシュ変数
let muniCache = null;

/**
 * public/muni.json を取得する関数（初回のみ通信を行い、以降はキャッシュを利用）
 */
export const fetchAllMuniData = async () => {
    if (muniCache) return muniCache;

    try {
        const res = await fetch('/muni.json');
        if (!res.ok) throw new Error('muni.json の読み込みに失敗しました');
        muniCache = await res.json();
        return muniCache;
    } catch (error) {
        console.error('自治体データの読み込みエラー:', error);
        return {};
    }
};

/**
 * 自治体コード（muniCd）を受け取り、対応する自治体オブジェクトを返す関数
 * @param {string} muniCd 
 * @returns {Promise<{pref: string, muni: string}|null>}
 */
export const getMuniInfo = async (muniCd) => {
    const data = await fetchAllMuniData();
    return data[muniCd] || null;
};