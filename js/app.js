(function () {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const config = window.APP_CONFIG || { USE_MOCK_API: true, APP_VERSION: '0.1.0' };

  const form = $('#report-form');
  const dialog = $('#confirm-dialog');
  const statusLive = $('#status-live');
  const globalError = $('#global-error');
  const locationButton = $('#get-location');
  const address = $('#address');
  const areaClassification = $('#areaClassification');
  const editAddressButton = $('#edit-address');
  const completion = $('#completion');
  let locationData = null;
  let addressWasEdited = false;
  let isSubmitting = false;
  let lastSubmittedLocation = null;

  const photos = new window.PhotoManager(
    $('#photos'),
    $('#photo-preview'),
    $('#photo-count'),
    $('#error-photos')
  );

  $('#app-version').textContent = `バージョン ${config.APP_VERSION || '0.1.0'}${config.USE_MOCK_API ? '（開発モード）' : ''}`;

  function toggle(element, visible) {
    element.classList.toggle('hidden', !visible);
  }

  function announce(message) {
    statusLive.textContent = '';
    window.setTimeout(() => { statusLive.textContent = message; }, 20);
  }

  function setLoading(button, loading, loadingText, normalText) {
    button.disabled = loading;
    $('.button-label', button).textContent = loading ? loadingText : normalText;
    toggle($('.spinner', button), loading);
  }

  function gpsErrorMessage(error) {
    if (!error) return 'GPS情報を取得できませんでした。';
    if (error.code === error.PERMISSION_DENIED) return '位置情報の利用が許可されていません。ブラウザの設定を確認してください。';
    if (error.code === error.POSITION_UNAVAILABLE) return 'GPS情報を取得できませんでした。屋外など見通しのよい場所で再度お試しください。';
    if (error.code === error.TIMEOUT) return 'GPS取得がタイムアウトしました。通信環境を確認して再度お試しください。';
    return 'GPS情報を取得できませんでした。';
  }

  function accuracyRating(accuracy) {
    if (accuracy <= 30) return { text: '良好', className: 'badge-good' };
    if (accuracy <= 80) return { text: '注意', className: 'badge-caution' };
    return { text: '再取得推奨', className: 'badge-poor' };
  }

  async function captureLocation() {
    $('#error-location').textContent = '';
    if (!navigator.geolocation) {
      $('#error-location').textContent = 'このブラウザは位置情報取得に対応していません。';
      return;
    }

    setLoading(locationButton, true, '現在地を取得中…', '現在地を取得する');
    announce('現在地を取得しています。');

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        });
      });
      locationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        gpsCapturedAt: new Date(position.timestamp).toISOString()
      };
      renderLocation();
      announce('現在地を取得しました。住所を確認しています。');

      try {
        const result = await window.ReportApi.reverseGeocode(locationData.latitude, locationData.longitude);
        address.value = result.address || '';
        areaClassification.value = result.areaClassification || '分類不能';
        address.readOnly = true;
        addressWasEdited = false;
        editAddressButton.disabled = false;
        announce('住所を取得しました。');
      } catch (error) {
        address.value = '';
        areaClassification.value = '分類不能';
        address.readOnly = false;
        editAddressButton.disabled = true;
        $('#error-address').textContent = `住所を自動取得できませんでした。住所を入力してください。${error.message}`;
        announce('住所を自動取得できませんでした。住所を入力してください。');
      }
    } catch (error) {
      const message = gpsErrorMessage(error);
      $('#error-location').textContent = message;
      announce(message);
    } finally {
      setLoading(locationButton, false, '現在地を取得中…', '現在地を取得する');
    }
  }

  function renderLocation() {
    const rating = accuracyRating(locationData.accuracy);
    $('#latitude-display').textContent = locationData.latitude.toFixed(6);
    $('#longitude-display').textContent = locationData.longitude.toFixed(6);
    $('#accuracy-display').textContent = `${Math.round(locationData.accuracy)}m`;
    $('#accuracy-rating').textContent = rating.text;
    $('#accuracy-rating').className = `badge ${rating.className}`;
    $('#captured-at-display').textContent = new Date(locationData.gpsCapturedAt).toLocaleString('ja-JP');
    const mapUrl = `https://www.google.com/maps?q=${locationData.latitude},${locationData.longitude}`;
    $('#map-link').href = mapUrl;
    toggle($('#location-result'), true);
  }

  function setError(name, message) {
    const error = $(`#error-${name}`);
    if (error) error.textContent = message;
    const field = document.getElementById(name) || $(`[name="${name}"]`);
    if (field) field.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function clearErrors() {
    $$('.field-error').forEach((element) => { element.textContent = ''; });
    $$('[aria-invalid="true"]').forEach((element) => element.removeAttribute('aria-invalid'));
    globalError.textContent = '';
    toggle(globalError, false);
  }

  function checkedValues(name) {
    return $$(`input[name="${name}"]:checked`).map((input) => input.value);
  }

  function validate() {
    clearErrors();
    const errors = [];
    const organizationType = $('#organizationType').value;
    const reporterName = $('#reporterName').value.trim();
    const reporterEmail = $('#reporterEmail').value.trim();
    const conditions = checkedValues('buildingCondition');
    const riskLevel = $('input[name="riskLevel"]:checked');
    const agreements = checkedValues('agreement');

    function add(name, message, target) {
      setError(name, message);
      errors.push(target || document.getElementById(name) || $(`[name="${name}"]`));
    }

    if (!organizationType) add('organizationType', '所属団体を選択してください。');
    if (organizationType === 'その他' && !$('#organizationOther').value.trim()) add('organizationOther', '団体名を入力してください。');
    if (!reporterName) add('reporterName', '報告者名を入力してください。');
    if (reporterEmail && !$('#reporterEmail').checkValidity()) add('reporterEmail', '正しいメールアドレスを入力してください。');
    if (!locationData) add('location', '現在地を取得してください。', locationButton);
    if (!address.value.trim()) add('address', '住所を入力してください。');
    if (photos.photos.length < 1) add('photos', '写真を1枚以上選択してください。', $('#photos'));
    if (!conditions.length) add('buildingConditions', '建物の外観状況を1つ以上選択してください。', $('#buildingConditions'));
    if (conditions.includes('その他') && !$('#buildingConditionOther').value.trim()) add('buildingConditionOther', 'その他の状況を入力してください。');
    if (!riskLevel) add('riskLevel', '危険度を選択してください。', $('#riskLevel'));
    if (agreements.length !== 5) add('agreements', 'すべての同意事項を確認してください。', $('#agreements'));

    if (errors.length) {
      globalError.textContent = `入力内容に${errors.length}件の不備があります。各項目を確認してください。`;
      toggle(globalError, true);
      globalError.focus();
      window.setTimeout(() => errors[0].scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
      return false;
    }
    return true;
  }

  function reportPayload() {
    const agreementValues = checkedValues('agreement');
    return {
      action: 'submitReport',
      appVersion: config.APP_VERSION || '0.1.0',
      submittedFrom: 'github-pages',
      organizationType: $('#organizationType').value,
      organizationOther: $('#organizationOther').value.trim(),
      reporterName: $('#reporterName').value.trim(),
      reporterEmail: $('#reporterEmail').value.trim(),
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      accuracy: locationData.accuracy,
      gpsCapturedAt: locationData.gpsCapturedAt,
      address: address.value.trim(),
      areaClassification: areaClassification.value.trim() || '分類不能',
      addressWasEdited,
      buildingConditions: checkedValues('buildingCondition'),
      buildingConditionOther: $('#buildingConditionOther').value.trim(),
      riskLevel: $('input[name="riskLevel"]:checked').value,
      comment: $('#comment').value,
      agreements: {
        noTrespassing: agreementValues.includes('noTrespassing'),
        safeLocation: agreementValues.includes('safeLocation'),
        candidateInformation: agreementValues.includes('candidateInformation'),
        privacyConsideration: agreementValues.includes('privacyConsideration'),
        purposeAgreement: agreementValues.includes('purposeAgreement')
      },
      photos: photos.getPayload()
    };
  }

  function addConfirmRow(label, value) {
    const row = document.createElement('div');
    const term = document.createElement('dt');
    const description = document.createElement('dd');
    term.textContent = label;
    description.textContent = value || '—';
    row.append(term, description);
    $('#confirm-list').append(row);
  }

  function showConfirmation() {
    const data = reportPayload();
    $('#confirm-list').replaceChildren();
    addConfirmRow('所属団体', data.organizationType === 'その他' ? `その他（${data.organizationOther}）` : data.organizationType);
    addConfirmRow('報告者名', data.reporterName);
    addConfirmRow('GPS座標', `${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}`);
    addConfirmRow('GPS精度', `${Math.round(data.accuracy)}m（${accuracyRating(data.accuracy).text}）`);
    addConfirmRow('住所', data.address);
    addConfirmRow('市区分類', data.areaClassification);
    addConfirmRow('写真枚数', `${data.photos.length}枚`);
    addConfirmRow('建物状況', data.buildingConditions.join('、') + (data.buildingConditionOther ? `：${data.buildingConditionOther}` : ''));
    addConfirmRow('危険度', data.riskLevel);
    addConfirmRow('自由記入内容', data.comment || 'なし');
    toggle($('#submit-error'), false);
    dialog.showModal();
  }

  async function submitConfirmed() {
    if (isSubmitting) return;
    isSubmitting = true;
    const backButton = $('#back-to-edit');
    const submitButton = $('#confirm-submit');
    backButton.disabled = true;
    submitButton.disabled = true;
    toggle($('#submit-status'), true);
    toggle($('#submit-error'), false);
    announce('写真と報告内容を送信しています。');

    try {
      const payload = reportPayload();
      const result = await window.ReportApi.submitReport(payload);
      lastSubmittedLocation = { latitude: payload.latitude, longitude: payload.longitude };
      dialog.close();
      form.classList.add('hidden');
      $('#record-id').textContent = result.recordId;
      $('#completion-map-link').href = `https://www.google.com/maps?q=${payload.latitude},${payload.longitude}`;
      toggle(completion, true);
      completion.focus();
      history.replaceState({ submitted: true }, document.title, location.href);
      announce('報告を受け付けました。');
    } catch (error) {
      $('#submit-error').textContent = error.message || '登録に失敗しました。時間をおいて再度お試しください。';
      toggle($('#submit-error'), true);
      announce('送信に失敗しました。');
    } finally {
      isSubmitting = false;
      backButton.disabled = false;
      submitButton.disabled = false;
      toggle($('#submit-status'), false);
    }
  }

  function resetForm() {
    form.reset();
    photos.clear();
    locationData = null;
    addressWasEdited = false;
    address.readOnly = true;
    editAddressButton.disabled = true;
    toggle($('#organization-other-wrap'), false);
    toggle($('#condition-other-wrap'), false);
    toggle($('#high-risk-notice'), false);
    toggle($('#location-result'), false);
    toggle(completion, false);
    form.classList.remove('hidden');
    $('#comment-count').textContent = '0';
    $('#comment-remaining').textContent = '500';
    clearErrors();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    $('#organizationType').focus();
  }

  locationButton.addEventListener('click', captureLocation);
  editAddressButton.addEventListener('click', () => {
    address.readOnly = false;
    addressWasEdited = true;
    address.focus();
  });
  $('#organizationType').addEventListener('change', (event) => {
    toggle($('#organization-other-wrap'), event.target.value === 'その他');
  });
  $('#conditionOtherCheck').addEventListener('change', (event) => {
    toggle($('#condition-other-wrap'), event.target.checked);
  });
  $$('input[name="riskLevel"]').forEach((input) => input.addEventListener('change', (event) => {
    toggle($('#high-risk-notice'), event.target.value === '高');
  }));
  $('#comment').addEventListener('input', (event) => {
    const length = Array.from(event.target.value).length;
    $('#comment-count').textContent = String(length);
    $('#comment-remaining').textContent = String(Math.max(0, 500 - length));
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (validate()) showConfirmation();
  });
  $('#back-to-edit').addEventListener('click', () => dialog.close());
  $('#confirm-submit').addEventListener('click', submitConfirmed);
  $('#new-report').addEventListener('click', resetForm);
  dialog.addEventListener('cancel', (event) => {
    if (isSubmitting) event.preventDefault();
  });
  window.addEventListener('popstate', () => {
    if (!completion.classList.contains('hidden')) history.pushState({ submitted: true }, document.title, location.href);
  });

  if (lastSubmittedLocation) {
    $('#completion-map-link').href = `https://www.google.com/maps?q=${lastSubmittedLocation.latitude},${lastSubmittedLocation.longitude}`;
  }
})();
