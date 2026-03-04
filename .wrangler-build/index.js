var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// _utils.ts
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
__name(json, "json");
async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
__name(readJson, "readJson");
function cleanText(value, maxLen) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return null;
  return normalized.length > maxLen ? normalized.slice(0, maxLen) : normalized;
}
__name(cleanText, "cleanText");
function cleanLongText(value, maxLen) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.length > maxLen ? normalized.slice(0, maxLen) : normalized;
}
__name(cleanLongText, "cleanLongText");
function parseBool(value) {
  if (value === true || value === 1 || value === "1" || value === "on") return 1;
  return 0;
}
__name(parseBool, "parseBool");
function parseOptionalInt(value) {
  if (value === null || value === void 0 || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
}
__name(parseOptionalInt, "parseOptionalInt");
function parseOptionalFloat(value) {
  if (value === null || value === void 0 || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}
__name(parseOptionalFloat, "parseOptionalFloat");
function parseLimit(value, fallback = 50, min = 1, max = 200) {
  if (!value) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const int = Math.trunc(n);
  if (int < min) return min;
  if (int > max) return max;
  return int;
}
__name(parseLimit, "parseLimit");
function validateMediaType(value) {
  if (value === "video" || value === "mixed") return value;
  return "image";
}
__name(validateMediaType, "validateMediaType");

// api/threads/[id].ts
var onRequestGet = /* @__PURE__ */ __name(async ({ env, params, request }) => {
  const threadId = Number(params.id);
  if (!Number.isInteger(threadId) || threadId <= 0) return json({ error: "Invalid thread id." }, 400);
  const includeNsfw = new URL(request.url).searchParams.get("nsfw") === "include" ? 1 : 0;
  const limit = parseLimit(new URL(request.url).searchParams.get("postLimit"), 200, 1, 500);
  const thread = await env.DB.prepare(
    `SELECT id, title, author_name AS authorName, model_name AS modelName,
            media_type AS mediaType, nsfw, created_at AS createdAt, updated_at AS updatedAt
     FROM threads
     WHERE id = ?1 AND (?2 = 1 OR nsfw = 0)`
  ).bind(threadId, includeNsfw).first();
  if (!thread) return json({ error: "Thread not found." }, 404);
  const { results: posts } = await env.DB.prepare(
    `SELECT id, thread_id AS threadId, body, prompt, workflow_json AS workflowJson,
            media_url AS mediaUrl, thumbnail_url AS thumbnailUrl,
            seed, sampler, steps, cfg_scale AS cfgScale,
            width, height, author_name AS authorName, nsfw,
            created_at AS createdAt
     FROM posts
     WHERE thread_id = ?1
     ORDER BY datetime(created_at) ASC
     LIMIT ?2`
  ).bind(threadId, limit).all();
  return json({ thread, posts, postLimit: limit, includeNsfw: includeNsfw === 1 });
}, "onRequestGet");

// api/health.ts
var onRequestGet2 = /* @__PURE__ */ __name(async ({ env }) => {
  try {
    const result = await env.DB.prepare("SELECT 1 as ok").first();
    return json({ ok: true, db: result?.ok === 1 });
  } catch (error) {
    return json({ ok: false, error: String(error) }, 500);
  }
}, "onRequestGet");

// api/posts/index.ts
var onRequestPost = /* @__PURE__ */ __name(async ({ env, request }) => {
  const payload = await readJson(request);
  if (!payload) return json({ error: "Invalid JSON body." }, 400);
  const threadId = parseOptionalInt(payload.threadId);
  const body = cleanLongText(payload.body, 5e3);
  const authorName = cleanText(payload.authorName ?? "anonymous", 40) ?? "anonymous";
  const nsfw = parseBool(payload.nsfw);
  const mediaUrl = cleanText(payload.mediaUrl, 2e3);
  const thumbnailUrl = cleanText(payload.thumbnailUrl, 2e3);
  const prompt = cleanLongText(payload.prompt, 4e3);
  const workflowJson = cleanLongText(payload.workflowJson, 2e4);
  const seed = parseOptionalInt(payload.seed);
  const sampler = cleanText(payload.sampler, 80);
  const steps = parseOptionalInt(payload.steps);
  const cfgScale = parseOptionalFloat(payload.cfgScale);
  const width = parseOptionalInt(payload.width);
  const height = parseOptionalInt(payload.height);
  if (!threadId || threadId <= 0) return json({ error: "Valid threadId is required." }, 400);
  if (!body) return json({ error: "Body is required." }, 400);
  const thread = await env.DB.prepare(`SELECT id FROM threads WHERE id = ?1`).bind(threadId).first();
  if (!thread) return json({ error: "Thread not found." }, 404);
  const result = await env.DB.prepare(
    `INSERT INTO posts (
      thread_id, body, prompt, workflow_json, media_url, thumbnail_url,
      seed, sampler, steps, cfg_scale, width, height, author_name, nsfw
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`
  ).bind(
    threadId,
    body,
    prompt,
    workflowJson,
    mediaUrl,
    thumbnailUrl,
    seed,
    sampler,
    steps,
    cfgScale,
    width,
    height,
    authorName,
    nsfw
  ).run();
  const postId = Number(result.meta.last_row_id);
  const created = await env.DB.prepare(
    `SELECT id, thread_id AS threadId, body, prompt, workflow_json AS workflowJson,
            media_url AS mediaUrl, thumbnail_url AS thumbnailUrl, seed, sampler,
            steps, cfg_scale AS cfgScale, width, height, author_name AS authorName,
            nsfw, created_at AS createdAt
     FROM posts
     WHERE id = ?1`
  ).bind(postId).first();
  return json({ post: created }, 201);
}, "onRequestPost");

// api/threads/index.ts
var onRequestGet3 = /* @__PURE__ */ __name(async ({ env, request }) => {
  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  const includeNsfw = url.searchParams.get("nsfw") === "include" ? 1 : 0;
  const query = `
    SELECT
      t.id,
      t.title,
      t.author_name AS authorName,
      t.model_name AS modelName,
      t.media_type AS mediaType,
      t.nsfw,
      t.created_at AS createdAt,
      t.updated_at AS updatedAt,
      COUNT(p.id) AS postCount
    FROM threads t
    LEFT JOIN posts p ON p.thread_id = t.id
    WHERE (?1 = 1 OR t.nsfw = 0)
    GROUP BY t.id
    ORDER BY datetime(t.updated_at) DESC
    LIMIT ?2
  `;
  const { results } = await env.DB.prepare(query).bind(includeNsfw, limit).all();
  return json({ threads: results, limit, includeNsfw: includeNsfw === 1 });
}, "onRequestGet");
var onRequestPost2 = /* @__PURE__ */ __name(async ({ env, request }) => {
  const payload = await readJson(request);
  if (!payload) return json({ error: "Invalid JSON body." }, 400);
  const title = cleanText(payload.title, 120);
  const body = cleanLongText(payload.body, 5e3);
  const authorName = cleanText(payload.authorName ?? "anonymous", 40) ?? "anonymous";
  const modelName = cleanText(payload.modelName, 80);
  const mediaType = validateMediaType(payload.mediaType);
  const nsfw = parseBool(payload.nsfw);
  const mediaUrl = cleanText(payload.mediaUrl, 2e3);
  const thumbnailUrl = cleanText(payload.thumbnailUrl, 2e3);
  const prompt = cleanLongText(payload.prompt, 4e3);
  const workflowJson = cleanLongText(payload.workflowJson, 2e4);
  const seed = parseOptionalInt(payload.seed);
  const sampler = cleanText(payload.sampler, 80);
  const steps = parseOptionalInt(payload.steps);
  const cfgScale = parseOptionalFloat(payload.cfgScale);
  const width = parseOptionalInt(payload.width);
  const height = parseOptionalInt(payload.height);
  if (!title || title.length < 3) return json({ error: "Title must be at least 3 chars." }, 400);
  if (!body) return json({ error: "Body is required." }, 400);
  const threadResult = await env.DB.prepare(
    `INSERT INTO threads (title, author_name, model_name, media_type, nsfw)
     VALUES (?1, ?2, ?3, ?4, ?5)`
  ).bind(title, authorName, modelName, mediaType, nsfw).run();
  const threadId = Number(threadResult.meta.last_row_id);
  await env.DB.prepare(
    `INSERT INTO posts (
      thread_id, body, prompt, workflow_json, media_url, thumbnail_url,
      seed, sampler, steps, cfg_scale, width, height, author_name, nsfw
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`
  ).bind(
    threadId,
    body,
    prompt,
    workflowJson,
    mediaUrl,
    thumbnailUrl,
    seed,
    sampler,
    steps,
    cfgScale,
    width,
    height,
    authorName,
    nsfw
  ).run();
  const created = await env.DB.prepare(
    `SELECT id, title, author_name AS authorName, model_name AS modelName,
            media_type AS mediaType, nsfw, created_at AS createdAt, updated_at AS updatedAt
     FROM threads
     WHERE id = ?1`
  ).bind(threadId).first();
  return json({ thread: created }, 201);
}, "onRequestPost");

// _middleware.ts
var onRequest = /* @__PURE__ */ __name(async (context) => {
  if (context.request.method === "OPTIONS") {
    return json({ ok: true });
  }
  const response = await context.next();
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("x-frame-options", "SAMEORIGIN");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}, "onRequest");

// ../.wrangler/tmp/pages-UsALwv/functionsRoutes-0.9164543238157076.mjs
var routes = [
  {
    routePath: "/api/threads/:id",
    mountPath: "/api/threads",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/health",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/posts",
    mountPath: "/api/posts",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/threads",
    mountPath: "/api/threads",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/api/threads",
    mountPath: "/api/threads",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/",
    mountPath: "/",
    method: "",
    middlewares: [onRequest],
    modules: []
  }
];

// ../node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
