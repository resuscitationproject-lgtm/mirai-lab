(function () {
  'use strict';

  const config = () => window.APP_CONFIG || {};
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function mockArea(latitude, longitude) {
    return {
      success: true,
      address: `福岡県北九州市八幡西区（開発用住所 ${Number(latitude).toFixed(4)}, ${Number(longitude).toFixed(4)}）`,
      prefecture: '福岡県',
      city: '北九州市',
      ward: '八幡西区',
      areaClassification: '北九州市／八幡西区'
    };
  }

  function mockRecordId() {
    const date = new Date();
    const parts = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ];
    const serial = String(Math.floor(Math.random() * 9000) + 1000);
    return `AKI-${parts.join('')}-${serial}`;
  }

  async function postToGas(payload) {
    const url = config().GAS_WEB_APP_URL;
    if (!url) {
      throw new Error('GAS WebアプリURLが設定されていません。');
    }

    // application/x-www-form-urlencoded の単純リクエストにして、
    // GASとの通信で不要なCORSプリフライトが発生しにくい形にする。
    const body = new URLSearchParams();
    body.set('payload', JSON.stringify(payload));

    const response = await fetch(url, {
      method: 'POST',
      body,
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`通信に失敗しました（HTTP ${response.status}）。`);
    }

    const data = await response.json();
    if (!data || data.success !== true) {
      throw new Error(data && data.message ? data.message : '処理に失敗しました。');
    }
    return data;
  }

  async function reverseGeocode(latitude, longitude) {
    if (config().USE_MOCK_API) {
      await wait(700);
      return mockArea(latitude, longitude);
    }
    return postToGas({
      action: 'reverseGeocode',
      latitude,
      longitude
    });
  }

  async function submitReport(report) {
    if (config().USE_MOCK_API) {
      await wait(1200);
      return {
        success: true,
        recordId: mockRecordId(),
        message: '報告を受け付けました'
      };
    }
    return postToGas(report);
  }

  window.ReportApi = { reverseGeocode, submitReport };
})();
