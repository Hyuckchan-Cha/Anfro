/* ===================== LLM API (OpenAI) ===================== */
/* API 키는 스크립트 속성(APIKEY_교사ID)에만 저장하고, 시트·화면에는 절대 내보내지 않는다. */

function apiKeyProp_(teacherId) { return 'APIKEY_' + teacherId; }
function baseUrlProp_(teacherId) { return 'AIBASE_' + teacherId; }

function aiBaseUrl_(teacherId) {
  var u = PropertiesService.getScriptProperties().getProperty(baseUrlProp_(teacherId));
  return String(u || DEFAULT_AI_BASE_URL).replace(/\/+$/, '');
}

function teacherAiConfig_(teacherId) {
  var t = getObj_(SH.TEACHER, teacherId);
  if (!t) throw userError_('담당 선생님 정보를 찾을 수 없어요. 선생님께 알려 주세요.');
  var key = PropertiesService.getScriptProperties().getProperty(apiKeyProp_(teacherId));
  if (!key) throw userError_('선생님이 아직 AI(API 키) 설정을 하지 않았어요. 선생님께 알려 주세요.', 'NOKEY');
  var model = str_(t['모델']).trim();
  // 예전에 다른 회사 모델을 저장해 두었다면 기본 OpenAI 모델로 바꾼다.
  if (!/^(gpt|o\d|chatgpt)/i.test(model)) model = PROVIDERS.openai.defaultModel;
  return { provider: 'openai', model: model, apiKey: key, teacherId: teacherId, baseUrl: aiBaseUrl_(teacherId) };
}

/**
 * opt: {system, user, images:[{mime, base64}], maxTokens, temperature, effort}
 * JSON 객체를 돌려준다.
 */
function llmJson_(cfg, opt) {
  var text = llmText_(cfg, opt, true);
  return parseJsonLoose_(text);
}

function llmText_(cfg, opt, wantJson) {
  var lastErr = null;
  for (var attempt = 0; attempt < 2; attempt++) {
    try {
      return callOpenAI_(cfg, opt, wantJson);
    } catch (e) {
      lastErr = e;
      if (!e.retryable) throw e;
      Utilities.sleep(1500 * (attempt + 1));
    }
  }
  throw lastErr;
}

/** GPT-4 계열만 temperature를 받는다. GPT-5·6, o 시리즈는 추론 모델이라 reasoning_effort를 쓴다. */
function isReasoningModel_(model) {
  return !/^(gpt-4|gpt-3|chatgpt-4)/i.test(model);
}

function callOpenAI_(cfg, opt, wantJson) {
  var hasImg = opt.images && opt.images.length;
  var content = opt.user;
  if (hasImg) {
    content = [{ type: 'text', text: opt.user }];
    opt.images.forEach(function (img) {
      content.push({ type: 'image_url', image_url: { url: 'data:' + img.mime + ';base64,' + img.base64, detail: 'high' } });
    });
  }
  var body = {
    model: cfg.model,
    messages: [{ role: 'system', content: opt.system }, { role: 'user', content: content }]
  };
  if (isReasoningModel_(cfg.model)) {
    // 추론 토큰도 이 한도에 포함되므로 넉넉히 준다.
    body.max_completion_tokens = Math.max(opt.maxTokens || 2000, 8000);
    body.reasoning_effort = opt.effort || 'low';
  } else {
    body.max_completion_tokens = opt.maxTokens || 2000;
    body.temperature = (opt.temperature === undefined) ? 0.2 : opt.temperature;
  }
  if (wantJson) body.response_format = { type: 'json_object' };
  var res;
  try {
    res = postChat_(cfg, body);
  } catch (e) {
    // 중계 서버가 일부 옵션을 모르면 그 옵션을 빼고 한 번 더 보낸다(JSON은 프롬프트로도 요청하므로 괜찮다).
    if (e.httpStatus !== 400 || !/reasoning|response_format|unsupported|unrecognized|unknown/i.test(e.message)) throw e;
    delete body.reasoning_effort;
    delete body.response_format;
    res = postChat_(cfg, body);
  }
  var ch = res.choices && res.choices[0];
  var text = ch && ch.message && ch.message.content;
  if (!text) throw aiEmpty_(ch && ch.finish_reason);
  return text;
}

/**
 * OpenAI 호환 주소는 보통 {base}/chat/completions 이지만, 주소 자체가 엔드포인트인 중계 서버도 있다.
 * 앞의 것이 404면 뒤의 것을 쓰고, 성공한 주소를 6시간 기억한다.
 */
function postChat_(cfg, body) {
  var base = cfg.baseUrl || OPENAI_BASE_URL;
  var headers = { Authorization: 'Bearer ' + cfg.apiKey };
  var cache = CacheService.getScriptCache();
  var cacheKey = 'aiurl_' + base.slice(0, 200);
  var known = cache.get(cacheKey);
  var urls = /\/chat\/completions$/.test(base) ? [base] : [base + '/chat/completions', base];
  if (known) urls = [known];
  for (var i = 0; i < urls.length; i++) {
    try {
      var res = fetchJson_(urls[i], headers, body);
      if (!known) cache.put(cacheKey, urls[i], 21600);
      return res;
    } catch (e) {
      if (e.httpStatus === 404 && i < urls.length - 1) continue;
      throw e;
    }
  }
}

function aiEmpty_(reason) {
  var e = new Error('AI 응답이 비어 있어요' + (reason ? ' (' + reason + ')' : '') + '. 다시 시도해 주세요.');
  e.retryable = true;
  return e;
}

function fetchJson_(url, headers, body) {
  var resp = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json', headers: headers,
    payload: JSON.stringify(body), muteHttpExceptions: true
  });
  var code = resp.getResponseCode();
  var txt = resp.getContentText();
  var json = null;
  try { json = JSON.parse(txt); } catch (e) { /* 무시 */ }
  if (code >= 200 && code < 300 && json) return json;
  var apiMsg = (json && json.error) ? (json.error.message || JSON.stringify(json.error)) : String(txt).slice(0, 300);
  var err;
  if (code === 401 || code === 403) err = userError_('AI API 키가 올바르지 않거나 권한이 없어요. 선생님 설정을 확인해 주세요. (' + code + ')', 'AIKEY');
  else if (code === 429) { err = userError_('AI 사용량 한도에 걸렸어요. 잠시 후 다시 시도해 주세요. (' + apiMsg.slice(0, 120) + ')', 'AILIMIT'); err.retryable = /rate/i.test(apiMsg); }
  else if (code === 404) err = userError_('AI 모델 이름을 확인해 주세요. (' + apiMsg.slice(0, 160) + ')', 'AIMODEL');
  else if (code >= 500) { err = new Error('AI 서버가 잠시 불안정해요(' + code + '). 다시 시도해 주세요.'); err.retryable = true; err.code = 'AI5XX'; }
  else err = userError_('AI 요청 오류(' + code + '): ' + apiMsg.slice(0, 200), 'AIERR');
  err.httpStatus = code;
  throw err;
}

/* ---------- JSON 해석 (LaTeX 역슬래시 보정 포함) ---------- */
function fixJsonEscapes_(raw) {
  var PH = '\u0001';
  var s = raw.replace(/\\\\/g, PH);
  // \frac, \times, \neq, \right 같은 LaTeX 명령이 JSON 이스케이프(\f \t \n \r \b \u)로 잘못 읽히지 않도록
  s = s.replace(/\\(?=(?:frac|dfrac|tfrac|times|theta|text|tan|tau|triangle|to\b|tilde|top|beta|bar|begin|boxed|because|big|binom|bmod|bot|backsim|bullet|forall|neq|ne\b|not|nabla|newline|nu\b|right|rangle|rho|rm\b|vec|underline|uparrow|upsilon))/g, PH);
  s = s.replace(/\\(?!["\\\/bfnrtu])/g, PH);
  s = s.replace(/\\u(?![0-9a-fA-F]{4})/g, PH + 'u');
  return s.split(PH).join('\\\\');
}

function parseJsonLoose_(text) {
  if (text && typeof text === 'object') return text;
  var t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  var s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s >= 0 && e > s) t = t.slice(s, e + 1);
  var tries = [fixJsonEscapes_(t), t, fixJsonEscapes_(t).replace(/,\s*([}\]])/g, '$1')];
  for (var i = 0; i < tries.length; i++) {
    try { return JSON.parse(tries[i]); } catch (err) { /* 다음 */ }
  }
  var ex = new Error('AI 응답을 해석하지 못했어요. 다시 시도해 주세요.');
  ex.retryable = true;
  throw ex;
}
