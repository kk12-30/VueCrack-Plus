const routerAnalysisContainer = document.getElementById('routerAnalysisContainer');
const pathListContainer = document.getElementById('pathListContainer');

// 全局变量存储路由分析结果
let vueAnalysisResult = null;

// URL清理函数
function cleanUrl(url) {
    return url.replace(/([^:]\/)\/+/g, '$1').replace(/\/$/, '');
}

// 安全的错误处理
function safeExecute(fn, context = 'Unknown') {
    try {
        return fn();
    } catch (error) {
        console.error(`Error in ${context}:`, error);
        showError(`${context}执行出错: ${error.message}`);
        return null;
    }
}

// 初始化函数
function init() {
    showLoading("正在检测Vue.js...");

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (chrome.runtime.lastError) {
            showError("无法获取当前标签页信息");
            return;
        }

        chrome.tabs.sendMessage(tabs[0].id, {action: "detectVue"}, function(response) {
            if (chrome.runtime.lastError) {
                showError("无法连接到页面，请刷新后重试。");
                return;
            }
        });
    });
}

// 显示加载中状态
function showLoading(message) {
    routerAnalysisContainer.innerHTML = `
        <div class="status-item info">
            <span class="loading-spinner"></span>
            ${message}
        </div>
    `;
}

// 显示错误信息
function showError(message) {
    routerAnalysisContainer.innerHTML = `
        <div class="status-item error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#d32f2f" stroke-width="2"/>
                <path d="M15 9L9 15" stroke="#d32f2f" stroke-width="2" stroke-linecap="round"/>
                <path d="M9 9L15 15" stroke="#d32f2f" stroke-width="2" stroke-linecap="round"/>
            </svg>
            ${message}
        </div>
    `;
}

// 显示Vue检测结果
function displayDetectionResult(result) {
    if (!result.detected) {
        routerAnalysisContainer.innerHTML = `
            <div class="status-item error">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#d32f2f" stroke-width="2"/>
                    <path d="M15 9L9 15" stroke="#d32f2f" stroke-width="2" stroke-linecap="round"/>
                    <path d="M9 9L15 15" stroke="#d32f2f" stroke-width="2" stroke-linecap="round"/>
                </svg>
                未检测到Vue
            </div>
        `;
        return;
    }

    showLoading("正在分析Vue路由");

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (chrome.runtime.lastError) {
            showError("无法获取当前标签页信息");
            return;
        }

        chrome.tabs.sendMessage(tabs[0].id, {action: "analyzeVueRouter"}, function(response) {
            if (chrome.runtime.lastError) {
                showError("无法分析路由，请刷新后重试。");
                return;
            }
        });
    });
}

// 显示Vue Router分析结果
function displayRouterAnalysis(result) {
    safeExecute(() => {
        vueAnalysisResult = result;

        if (!result.routerDetected) {
            routerAnalysisContainer.innerHTML = `
                <div class="status-item error">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#d32f2f" stroke-width="2"/>
                        <path d="M15 9L9 15" stroke="#d32f2f" stroke-width="2" stroke-linecap="round"/>
                        <path d="M9 9L15 15" stroke="#d32f2f" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    未检测到Vue Router
                </div>
            `;
            return;
        }

        // 显示框架信息
        let html = `<div class="framework-info">`;
        html += `<h3>Vue Router 分析</h3>`;
        html += `<span class="version-badge">${result.vueVersion || 'Unknown'}</span>`;
        html += `<span class="badge">${result.framework || 'Vue.js'}</span>`;
        if (result.buildTool) {
            html += `<span class="build-tool-badge">${result.buildTool}</span>`;
        }
        html += `</div>`;

        html += `<div class="status-indicators">`;

        if (result.modifiedRoutes && Array.isArray(result.modifiedRoutes) && result.modifiedRoutes.length > 0) {
            html += `
                <div class="status-item info">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#1976d2" stroke-width="2"/>
                        <path d="M12 8V12" stroke="#1976d2" stroke-width="2" stroke-linecap="round"/>
                        <circle cx="12" cy="16" r="1" fill="#1976d2"/>
                    </svg>
                    已修改 ${result.modifiedRoutes.length} 个路由的 auth 字段
                </div>
            `;
        }

        if (result.securityBypass?.routerGuardsCleared) {
            html += `
                <div class="status-item success">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#2e7d32" stroke-width="2"/>
                        <path d="M8 12L11 15L16 9" stroke="#2e7d32" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    增强安全绕过已执行
                </div>
            `;
        }

        html += `</div>`;
        routerAnalysisContainer.innerHTML = html;

        // 显示各种信息
        console.log('📊 准备显示分析结果:', {
            hasAllRoutes: !!(result.allRoutes || result),
            hasPathDefinitions: !!result.pathDefinitions,
            pathDefinitionsStructure: result.pathDefinitions
        });
        
        displayUrlList(result.allRoutes || result);
        displayPathInfo(result.pathDefinitions);

        // 设置标签切换
        setupTabSwitching();
    }, 'displayRouterAnalysis');
}

// 添加事件监听器
function addEventListeners() {
    safeExecute(() => {
        // 路径复制按钮
        const copyPathsBtn = document.getElementById('copyPathsBtn');
        if (copyPathsBtn) {
            copyPathsBtn.addEventListener('click', function() {
                if (!vueAnalysisResult || !Array.isArray(vueAnalysisResult.allRoutes)) {
                    this.textContent = '没有数据';
                    setTimeout(() => {
                        this.textContent = '复制所有路径';
                    }, 2000);
                    return;
                }
                const paths = vueAnalysisResult.allRoutes
                    .map(route => route.path)
                    .filter(Boolean);
                const pathsText = paths.join('\n');

                navigator.clipboard.writeText(pathsText).then(() => {
                    this.textContent = '已复制!';
                    setTimeout(() => {
                        this.textContent = '复制所有路径';
                    }, 2000);
                }).catch(err => {
                    console.error('复制失败:', err);
                    this.textContent = '复制失败';
                    setTimeout(() => {
                        this.textContent = '复制所有路径';
                    }, 2000);
                });
            });
        }

        // URL复制按钮
        const copyUrlsBtn = document.getElementById('copyUrlsBtn');
        if (copyUrlsBtn) {
            copyUrlsBtn.addEventListener('click', function() {
                const basePathUrls = document.querySelectorAll('.base-path-urls .url-text');
                const standardUrls = document.querySelectorAll('.standard-urls .url-text');

                let urlsToUse = [];

                if (basePathUrls.length > 0) {
                    urlsToUse = Array.from(basePathUrls).map(el => el.textContent);
                    const basePathPaths = new Set();
                    Array.from(standardUrls).forEach(el => {
                        if (!Array.from(basePathUrls).some(baseEl =>
                            baseEl.textContent.includes(el.textContent.split('/').pop()))) {
                            urlsToUse.push(el.textContent);
                        }
                    });
                } else {
                    urlsToUse = Array.from(standardUrls).map(el => el.textContent);
                }

                const urlsText = urlsToUse.join('\n');

                navigator.clipboard.writeText(urlsText).then(() => {
                    this.textContent = '已复制!';
                    setTimeout(() => {
                        this.textContent = '复制所有URL';
                    }, 2000);
                }).catch(err => {
                    console.error('复制失败:', err);
                    this.textContent = '复制失败';
                    setTimeout(() => {
                        this.textContent = '复制所有URL';
                    }, 2000);
                });
            });
        }

        // 单个URL复制按钮
        const urlCopyBtns = document.querySelectorAll('.url-copy-btn');
        urlCopyBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const url = this.getAttribute('data-url');
                navigator.clipboard.writeText(url).then(() => {
                    this.textContent = '已复制!';
                    setTimeout(() => {
                        this.textContent = '复制';
                    }, 2000);
                }).catch(err => {
                    console.error('复制失败:', err);
                    this.textContent = '失败';
                    setTimeout(() => {
                        this.textContent = '复制';
                    }, 2000);
                });
            });
        });

        // 单个URL打开按钮
        const urlOpenBtns = document.querySelectorAll('.url-open-btn');
        urlOpenBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const url = this.getAttribute('data-url');
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    if (!chrome.runtime.lastError) {
                        chrome.tabs.update(tabs[0].id, {url: url});
                    }
                });
            });
        });

        // 批量测试按钮
        const batchTestBtn = document.getElementById('batchTestBtn');
        if (batchTestBtn) {
            batchTestBtn.addEventListener('click', function() {
                performBatchTest();
            });
        }
    }, 'addEventListeners');
}

// 显示URL列表
function displayUrlList(routes) {
    // 数据验证和修复
    if (!routes) {
        pathListContainer.innerHTML = `<p>没有找到路由路径</p>`;
        return;
    }

    // 确保routes是数组
    let routeArray = [];
    if (Array.isArray(routes)) {
        routeArray = routes;
    } else if (routes.allRoutes && Array.isArray(routes.allRoutes)) {
        routeArray = routes.allRoutes;
    } else if (typeof routes === 'object' && routes !== null) {
        // 如果routes是对象，尝试提取路由信息
        const keys = Object.keys(routes);
        routeArray = keys.map(key => {
            const route = routes[key];
            return {
                path: route.path || key,
                name: route.name || key
            };
        });
    } else {
        pathListContainer.innerHTML = `<p>路由数据格式错误</p>`;
        return;
    }

    // 过滤掉无效的路由
    const validRoutes = routeArray.filter(route =>
        route &&
        typeof route === 'object' &&
        route.path &&
        typeof route.path === 'string'
    );

    if (!validRoutes.length) {
        pathListContainer.innerHTML = `<p>没有找到有效的路由路径</p>`;
        return;
    }

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (chrome.runtime.lastError) {
            showError("无法获取当前标签页信息");
            return;
        }

        safeExecute(() => {
            const currentUrl = tabs[0].url;
            const urlObj = new URL(currentUrl);
            const domainBase = urlObj.origin;
            const currentPath = urlObj.pathname;

            let baseUrl = '';
            let isHistoryMode = false;

            if (currentUrl.includes('#/') || currentUrl.includes('#')) {
                const hashIndex = currentUrl.indexOf('#');
                baseUrl = currentUrl.substring(0, hashIndex + 1);
            } else {
                isHistoryMode = true;
                baseUrl = domainBase;
            }

            // 使用验证后的路由数组
            const paths = validRoutes.map(route => route.path).filter(Boolean);

            // 多层次基础路径检测
            let detectedBasePath = '';

            if (vueAnalysisResult?.routerBase) {
                detectedBasePath = vueAnalysisResult.routerBase;
            } else if (vueAnalysisResult?.pageAnalysis?.detectedBasePath) {
                detectedBasePath = vueAnalysisResult.pageAnalysis.detectedBasePath;
            } else {
                const pathSegments = currentPath.split('/').filter(Boolean);
                if (pathSegments.length > 1) {
                    detectedBasePath = '/' + pathSegments[0];
                }
            }

            const standardUrls = [];
            const basePathUrls = [];

            paths.forEach(path => {
                const cleanPath = path.startsWith('/') ? path.substring(1) : path;
                let standardUrl;
                let basePathUrl = null;

                if (isHistoryMode) {
                    standardUrl = `${baseUrl}/${cleanPath}`;
                    if (detectedBasePath && !path.startsWith(detectedBasePath)) {
                        basePathUrl = `${baseUrl}${detectedBasePath}/${cleanPath}`;
                    }
                } else if (baseUrl.endsWith('#')) {
                    standardUrl = `${baseUrl}/${cleanPath}`;
                } else if (baseUrl.endsWith('#/')) {
                    standardUrl = `${baseUrl}${cleanPath}`;
                } else {
                    standardUrl = `${baseUrl}#/${cleanPath}`;
                }

                standardUrl = cleanUrl(standardUrl);
                if (basePathUrl) {
                    basePathUrl = cleanUrl(basePathUrl);
                }

                standardUrls.push({ path: path, url: standardUrl });
                if (basePathUrl) {
                    basePathUrls.push({ path: path, url: basePathUrl });
                }
            });

            let html = `<h3>完整URL列表</h3>`;

            if (detectedBasePath && isHistoryMode) {
                html += `
                <div class="base-path-info">
                    <div class="status-item info">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#1976d2" stroke-width="2"/>
                          <path d="M12 8V12" stroke="#1976d2" stroke-width="2" stroke-linecap="round"/>
                          <circle cx="12" cy="16" r="1" fill="#1976d2"/>
                        </svg>
                        检测到基础路径: ${detectedBasePath}
                    </div>
                </div>`;
            }

            if (basePathUrls.length > 0) {
                html += `
                <div class="url-section">
                    <div class="url-section-header">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill="#e3f2fd" stroke="#1976d2" stroke-width="1.5"/>
                          <path d="M8 12L11 15L16 9" stroke="#1976d2" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span>带基础路径的URL (推荐)</span>
                    </div>
                    <div class="full-urls-list base-path-urls">`;

                basePathUrls.forEach(item => {
                    html += `<div class="full-url-item">
                        <span class="url-text">${item.url}</span>
                        <button class="url-copy-btn" data-url="${item.url}">复制</button>
                        <button class="url-open-btn" data-url="${item.url}">打开</button>
                    </div>`;
                });

                html += `</div></div>`;
            }

            html += `
            <div class="url-section">
                <div class="url-section-header">
                    <span>标准URL</span>
                </div>
                <div class="full-urls-list standard-urls">`;

            standardUrls.forEach(item => {
                html += `<div class="full-url-item">
                    <span class="url-text">${item.url}</span>
                    <button class="url-copy-btn" data-url="${item.url}">复制</button>
                    <button class="url-open-btn" data-url="${item.url}">打开</button>
                </div>`;
            });

            html += `</div></div>`;

            html += `
                <div class="copy-actions">
                    <button id="copyPathsBtn" class="secondary-btn">复制所有路径</button>
                    <button id="copyUrlsBtn" class="secondary-btn">复制所有URL</button>
                    <button id="batchTestBtn" class="secondary-btn">批量测试</button>
                </div>
                <div id="batchTestContainer" style="margin-top: 15px;"></div>
            `;

            pathListContainer.innerHTML = html;
            setTimeout(addEventListeners, 100);

        }, 'displayUrlList');
    });
}

// 显示Path路径信息
function displayPathInfo(pathInfo) {
    console.log('📥 popup接收到pathInfo:', pathInfo);
    
    const container = document.getElementById('apiContainer');
    if (!pathInfo) {
        console.log('⚠️ pathInfo为空或未定义');
        container.innerHTML = '<p>未检测到Path路径</p>';
        return;
    }

    // 安全检查数组
    const paths = Array.isArray(pathInfo.paths) ? pathInfo.paths : [];
    console.log('📋 处理的paths数组:', paths.length, '个路径');

    if (paths.length === 0) {
        container.innerHTML = `
            <h3>Path路径列表</h3>
            <p>未发现Path路径</p>
            <p style="font-size: 12px; color: #666;">💡 提示: 查找形如 <code>path: "/monitor/job-log"</code> 的路径定义</p>
        `;
        return;
    }

    // 按来源分组路径
    const groupedPaths = {};
    paths.forEach(pathItem => {
        const source = pathItem.source || 'JS';
        if (!groupedPaths[source]) {
            groupedPaths[source] = [];
        }
        groupedPaths[source].push(pathItem);
    });

    let html = `<h3>Path路径列表</h3>`;

    // 显示统计信息
    html += `
        <div class="base-path-info">
            <div class="status-item success">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill="#e8f5e8" stroke="#4caf50" stroke-width="1.5"/>
                  <path d="M8 12L11 15L16 9" stroke="#4caf50" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                发现 ${paths.length} 个Path路径定义
            </div>
        </div>`;

    // 按来源显示路径
    Object.keys(groupedPaths).forEach(source => {
        const sourcePaths = groupedPaths[source];
        html += `
            <div class="url-section">
                <div class="url-section-header">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill="#e3f2fd" stroke="#1976d2" stroke-width="1.5"/>
                      <path d="M8 12L11 15L16 9" stroke="#1976d2" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span>${source} (${sourcePaths.length}个)</span>
                </div>
                <div class="full-urls-list">`;

        sourcePaths.forEach(pathItem => {
            html += `
                <div class="full-url-item">
                    <span class="url-text">${pathItem.path}</span>
                    <button class="url-copy-btn" data-path="${pathItem.path}">复制</button>
                </div>`;
        });

        html += `</div></div>`;
    });

    // 添加操作按钮
    html += `
        <div class="copy-actions">
            <button id="copyApiPathsBtn" class="secondary-btn">复制所有路径</button>
            <button id="copyApiUrlsBtn" class="secondary-btn">复制为URL</button>
        </div>
        <div id="pathTestContainer" style="margin-top: 15px;"></div>
    `;

    container.innerHTML = html;

    // 添加事件监听器
    setTimeout(() => {
        // 复制所有路径按钮
        const copyApiPathsBtn = document.getElementById('copyApiPathsBtn');
        if (copyApiPathsBtn) {
            copyApiPathsBtn.addEventListener('click', function() {
                const pathTexts = paths.map(p => p.path).join('\n');
                navigator.clipboard.writeText(pathTexts).then(() => {
                    this.textContent = '已复制!';
                    setTimeout(() => {
                        this.textContent = '复制所有路径';
                    }, 2000);
                }).catch(() => {
                    this.textContent = '复制失败';
                    setTimeout(() => {
                        this.textContent = '复制所有路径';
                    }, 2000);
                });
            });
        }

        // 复制为URL按钮
        const copyApiUrlsBtn = document.getElementById('copyApiUrlsBtn');
        if (copyApiUrlsBtn) {
            copyApiUrlsBtn.addEventListener('click', function() {
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    if (chrome.runtime.lastError) {
                        copyApiUrlsBtn.textContent = '获取URL失败';
                        setTimeout(() => {
                            copyApiUrlsBtn.textContent = '复制为URL';
                        }, 2000);
                        return;
                    }

                    const currentUrl = tabs[0].url;
                    const urlObj = new URL(currentUrl);
                    const domainBase = urlObj.origin;
                    
                    const urls = paths.map(p => `${domainBase}${p.path}`).join('\n');
                    navigator.clipboard.writeText(urls).then(() => {
                        copyApiUrlsBtn.textContent = '已复制!';
                        setTimeout(() => {
                            copyApiUrlsBtn.textContent = '复制为URL';
                        }, 2000);
                    }).catch(() => {
                        copyApiUrlsBtn.textContent = '复制失败';
                        setTimeout(() => {
                            copyApiUrlsBtn.textContent = '复制为URL';
                        }, 2000);
                    });
                });
            });
        }

        // 单个路径复制按钮
        const pathCopyBtns = document.querySelectorAll('.url-copy-btn[data-path]');
        pathCopyBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const path = this.getAttribute('data-path');
                navigator.clipboard.writeText(path).then(() => {
                    this.textContent = '已复制!';
                    setTimeout(() => {
                        this.textContent = '复制';
                    }, 2000);
                }).catch(() => {
                    this.textContent = '失败';
                    setTimeout(() => {
                        this.textContent = '复制';
                    }, 2000);
                });
            });
        });
    }, 100);
}

// 设置标签切换
function setupTabSwitching() {
    const tabs = document.querySelectorAll('.info-tab');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // 移除所有活动状态
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            // 设置当前标签为活动状态
            tab.classList.add('active');
            const targetTab = tab.getAttribute('data-tab');
            document.getElementById(`tab-${targetTab}`).classList.add('active');
        });
    });

    // 设置导出功能
    setupExportFeatures();
}

// 设置导出功能
function setupExportFeatures() {
    const exportJsonBtn = document.getElementById('exportJsonBtn');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const exportReportBtn = document.getElementById('exportReportBtn');

    if (exportJsonBtn) {
        exportJsonBtn.addEventListener('click', exportToJSON);
    }
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', exportToCSV);
    }
    if (exportReportBtn) {
        exportReportBtn.addEventListener('click', exportToReport);
    }
}

// 导出为JSON
function exportToJSON() {
    if (!vueAnalysisResult) {
        showExportResult('没有可导出的数据', 'error');
        return;
    }

    try {
        const exportData = {
            timestamp: new Date().toISOString(),
            url: window.location.href,
            framework: vueAnalysisResult.framework,
            version: vueAnalysisResult.vueVersion,
            buildTool: vueAnalysisResult.buildTool,
            routes: vueAnalysisResult.allRoutes,
            pathDefinitions: vueAnalysisResult.pathDefinitions
        };

        const jsonData = JSON.stringify(exportData, null, 2);
        downloadFile(jsonData, 'vue-analysis-result.json', 'application/json');
        showExportResult('JSON 文件已生成并下载', 'success');
    } catch (error) {
        showExportResult('导出 JSON 失败: ' + error.message, 'error');
    }
}

// 导出为CSV
function exportToCSV() {
    if (!vueAnalysisResult || !Array.isArray(vueAnalysisResult.allRoutes) || vueAnalysisResult.allRoutes.length === 0) {
        showExportResult('没有可导出的路由数据', 'error');
        return;
    }

    try {
        let csvData = '路由名称,路径,组件,需要认证,角色,参数,示例路径\n';

        vueAnalysisResult.allRoutes.forEach(route => {
            const name = route.name || '';
            const path = route.path || '';
            const component = route.component || '';
            const requiresAuth = route.requiresAuth ? '是' : '否';
            const roles = route.roles ? route.roles.join(';') : '';
            const params = route.analysis?.parameters ? route.analysis.parameters.join(';') : '';
            const examples = route.analysis?.examples ? route.analysis.examples.join(';') : '';

            csvData += `"${name}","${path}","${component}","${requiresAuth}","${roles}","${params}","${examples}"\n`;
        });

        // 添加Path路径数据
        if (vueAnalysisResult.pathDefinitions && vueAnalysisResult.pathDefinitions.paths && vueAnalysisResult.pathDefinitions.paths.length > 0) {
            csvData += '\nPath路径,来源\n';
            vueAnalysisResult.pathDefinitions.paths.forEach(pathInfo => {
                csvData += `"${pathInfo.path}","${pathInfo.source}"\n`;
            });
        }

        downloadFile(csvData, 'vue-routes-analysis.csv', 'text/csv;charset=utf-8');
        showExportResult('CSV 文件已生成并下载', 'success');
    } catch (error) {
        showExportResult('导出 CSV 失败: ' + error.message, 'error');
    }
}

// 生成分析报告
function exportToReport() {
    if (!vueAnalysisResult) {
        showExportResult('没有可导出的数据', 'error');
        return;
    }

    try {
        const report = generateAnalysisReport(vueAnalysisResult);
        downloadFile(report, 'vue-security-analysis-report.html', 'text/html');
        showExportResult('分析报告已生成并下载', 'success');
    } catch (error) {
        showExportResult('生成报告失败: ' + error.message, 'error');
    }
}

// 生成HTML分析报告
function generateAnalysisReport(data) {
    const timestamp = new Date().toLocaleString('zh-CN');
    
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vue.js 安全分析报告</title>
    <style>
        body { font-family: 'Microsoft YaHei', sans-serif; margin: 40px; line-height: 1.6; }
        .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #41b883; padding-bottom: 20px; }
        .section { margin: 30px 0; }
        .section h2 { color: #35495e; border-left: 4px solid #41b883; padding-left: 10px; }
        .info-box { background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 10px 0; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; }
        .success { background: #d4edda; border-left: 4px solid #28a745; }
        .danger { background: #f8d7da; border-left: 4px solid #dc3545; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .route-params { font-family: monospace; background: #f5f5f5; padding: 2px 4px; border-radius: 3px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔍 Vue.js 安全分析报告</h1>
        <p><strong>生成时间:</strong> ${timestamp}</p>
        <p><strong>目标URL:</strong> ${window.location.href}</p>
    </div>

    <div class="section">
        <h2>📋 基本信息</h2>
        <div class="info-box">
            <p><strong>框架:</strong> ${data.framework}</p>
            <p><strong>版本:</strong> ${data.vueVersion}</p>
            ${data.buildTool ? `<p><strong>构建工具:</strong> ${data.buildTool}</p>` : ''}
            <p><strong>路由检测:</strong> ${data.routerDetected ? '✅ 已检测到' : '❌ 未检测到'}</p>
        </div>
    </div>


    <div class="section">
        <h2>🔍 路由分析</h2>
        ${data.allRoutes && data.allRoutes.length > 0 ? `
        <p><strong>发现路由数量:</strong> ${data.allRoutes.length} 个</p>
        <table>
            <tr>
                <th>路由名称</th>
                <th>路径</th>
                <th>组件</th>
                <th>参数</th>
                <th>认证要求</th>
                <th>风险级别</th>
            </tr>
            ${data.allRoutes.map(route => {
                const hasParams = route.analysis?.hasParams || false;
                const requiresAuth = route.requiresAuth || route.meta?.requiresAuth || false;
                const riskLevel = !requiresAuth && (route.path.includes('admin') || route.path.includes('manage')) ? '🔴 高风险' : 
                                 hasParams ? '🟡 中风险' : '🟢 低风险';
                
                return `<tr>
                    <td>${route.name || '-'}</td>
                    <td><code>${route.path}</code></td>
                    <td>${route.component || '-'}</td>
                    <td>${route.analysis?.parameters ? route.analysis.parameters.map(p => `<span class="route-params">:${p}</span>`).join(' ') : '-'}</td>
                    <td>${requiresAuth ? '✅ 需要' : '❌ 不需要'}</td>
                    <td>${riskLevel}</td>
                </tr>`;
            }).join('')}
        </table>
        ` : '<div class="info-box">未发现路由</div>'}
    </div>

    <div class="section">
        <h2>🌐 Path路径发现</h2>
        ${data.pathDefinitions && data.pathDefinitions.paths?.length > 0 ? `
        <p><strong>发现Path定义:</strong> ${data.pathDefinitions.paths.length} 个</p>
        <table>
            <tr><th>路径</th><th>来源</th></tr>
            ${data.pathDefinitions.paths.map(pathInfo => 
                `<tr><td><code>${pathInfo.path}</code></td><td>${pathInfo.source}</td></tr>`
            ).join('')}
        </table>
        ` : '<div class="info-box">未发现Path路径定义</div>'}
    </div>

    <div class="section">
        <h2>⚠️ 安全建议</h2>
        <div class="info-box warning">
            <h3>发现的潜在问题:</h3>
            <ul>
                ${data.allRoutes?.some(r => !r.requiresAuth && (r.path.includes('admin') || r.path.includes('manage'))) ? 
                    '<li>❌ 发现未受保护的管理页面路由</li>' : ''}
                ${data.allRoutes?.some(r => r.analysis?.hasParams) ? 
                    '<li>🟡 发现包含参数的动态路由，建议进行参数验证</li>' : ''}
                ${data.pathDefinitions?.paths?.some(p => p.path.includes('admin') || p.path.includes('system')) ?
                    '<li>🟡 发现敏感Path路径，请检查权限控制</li>' : ''}
            </ul>
            
            <h3>安全加固建议:</h3>
            <ul>
                <li>✅ 对所有敏感路由添加适当的路由守卫</li>
                <li>✅ 实施服务端权限验证，不要仅依赖前端控制</li>
                <li>✅ 对动态路由参数进行严格的输入验证</li>
                <li>✅ 定期审查路由配置，移除不必要的路由</li>
                <li>✅ 实施适当的会话管理和token验证机制</li>
            </ul>
        </div>
    </div>

    <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666;">
        <p>报告由 VueCrack 插件生成 | 仅用于授权的安全测试</p>
    </div>
</body>
</html>`;
}

// 下载文件
function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 显示导出结果
function showExportResult(message, type) {
    const container = document.getElementById('exportResult');
    const className = type === 'success' ? 'success-badge' : 'warning-badge';
    container.innerHTML = `<div class="info-box"><span class="${className}">${message}</span></div>`;
    
    setTimeout(() => {
        container.innerHTML = '';
    }, 3000);
}

// 批量测试功能
function performBatchTest() {
    if (!vueAnalysisResult || !Array.isArray(vueAnalysisResult.allRoutes) || vueAnalysisResult.allRoutes.length === 0) {
        showBatchTestResult('没有可测试的路由', 'error');
        return;
    }

    const container = document.getElementById('batchTestContainer');
    const urls = [];

    // 收集所有URL
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (chrome.runtime.lastError) {
            showBatchTestResult('无法获取当前标签页信息', 'error');
            return;
        }

        const currentUrl = tabs[0].url;
        const urlObj = new URL(currentUrl);
        const domainBase = urlObj.origin;
        
        let baseUrl = '';
        let isHistoryMode = false;

        if (currentUrl.includes('#/') || currentUrl.includes('#')) {
            const hashIndex = currentUrl.indexOf('#');
            baseUrl = currentUrl.substring(0, hashIndex + 1);
        } else {
            isHistoryMode = true;
            baseUrl = domainBase;
        }

        // 生成测试URL列表
        const testUrls = [];
        vueAnalysisResult.allRoutes.forEach(route => {
            if (route.path && route.path !== '/') {
                const cleanPath = route.path.startsWith('/') ? route.path.substring(1) : route.path;
                let testUrl;

                if (isHistoryMode) {
                    testUrl = `${baseUrl}/${cleanPath}`;
                } else if (baseUrl.endsWith('#')) {
                    testUrl = `${baseUrl}/${cleanPath}`;
                } else if (baseUrl.endsWith('#/')) {
                    testUrl = `${baseUrl}${cleanPath}`;
                } else {
                    testUrl = `${baseUrl}#/${cleanPath}`;
                }

                // 处理参数路由，生成示例
                if (route.analysis?.hasParams && route.analysis.examples) {
                    route.analysis.examples.forEach(example => {
                        const exampleUrl = isHistoryMode ? 
                            `${domainBase}${example}` : 
                            `${baseUrl}${example.startsWith('/') ? example.substring(1) : example}`;
                        testUrls.push({
                            name: route.name || route.path,
                            url: cleanUrl(exampleUrl),
                            original: route.path,
                            hasParams: true
                        });
                    });
                } else {
                    testUrls.push({
                        name: route.name || route.path,
                        url: cleanUrl(testUrl),
                        original: route.path,
                        hasParams: false
                    });
                }
            }
        });

        if (testUrls.length === 0) {
            showBatchTestResult('没有可测试的路由', 'error');
            return;
        }

        // 开始批量测试
        startBatchTesting(testUrls);
    });
}

// 开始批量测试
function startBatchTesting(urls) {
    const container = document.getElementById('batchTestContainer');
    let html = `
        <div class="enhanced-info">
            <h4>🔍 批量测试进行中...</h4>
            <p>正在测试 ${urls.length} 个URL，请稍候...</p>
            <div id="testProgress">
                <div style="background: #e0e0e0; height: 4px; border-radius: 2px; margin: 10px 0;">
                    <div id="progressBar" style="background: #41b883; height: 4px; border-radius: 2px; width: 0%; transition: width 0.3s;"></div>
                </div>
                <div id="testResults"></div>
            </div>
        </div>
    `;
    container.innerHTML = html;

    const results = [];
    let completedTests = 0;

    // 批量测试函数
    function testUrl(urlInfo, index) {
        return new Promise((resolve) => {
            const img = new Image();
            const startTime = Date.now();
            
            // 设置超时
            const timeout = setTimeout(() => {
                resolve({
                    ...urlInfo,
                    status: 'timeout',
                    responseTime: 5000,
                    accessible: false
                });
            }, 5000);

            img.onload = () => {
                clearTimeout(timeout);
                resolve({
                    ...urlInfo,
                    status: 'success',
                    responseTime: Date.now() - startTime,
                    accessible: true
                });
            };

            img.onerror = () => {
                clearTimeout(timeout);
                // 尝试用fetch进行更准确的测试
                fetch(urlInfo.url, { 
                    method: 'HEAD', 
                    mode: 'no-cors',
                    cache: 'no-cache'
                }).then(() => {
                    resolve({
                        ...urlInfo,
                        status: 'accessible',
                        responseTime: Date.now() - startTime,
                        accessible: true
                    });
                }).catch(() => {
                    resolve({
                        ...urlInfo,
                        status: 'error',
                        responseTime: Date.now() - startTime,
                        accessible: false
                    });
                });
            };

            // 尝试加载图像来测试URL可访问性
            img.src = urlInfo.url + '/favicon.ico?' + Math.random();
        });
    }

    // 并发测试（每次最多5个）
    async function runTests() {
        const batchSize = 5;
        for (let i = 0; i < urls.length; i += batchSize) {
            const batch = urls.slice(i, i + batchSize);
            const batchPromises = batch.map((url, index) => testUrl(url, i + index));
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            
            completedTests += batch.length;
            const progress = (completedTests / urls.length) * 100;
            
            // 更新进度条
            const progressBar = document.getElementById('progressBar');
            if (progressBar) {
                progressBar.style.width = progress + '%';
            }
            
            // 显示部分结果
            updateTestResults(results);
            
            // 添加小延迟避免过于频繁的请求
            if (i + batchSize < urls.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        // 测试完成
        displayFinalResults(results);
    }

    runTests().catch(error => {
        console.error('Batch testing error:', error);
        showBatchTestResult('批量测试过程中发生错误', 'error');
    });
}

// 更新测试结果显示
function updateTestResults(results) {
    const resultsContainer = document.getElementById('testResults');
    if (!resultsContainer) return;

    const accessible = results.filter(r => r.accessible).length;
    const total = results.length;

    let html = `<p>已测试: ${total} | 可访问: <span class="success-badge">${accessible}</span> | 不可访问: <span class="warning-badge">${total - accessible}</span></p>`;
    resultsContainer.innerHTML = html;
}

// 显示最终测试结果
function displayFinalResults(results) {
    const container = document.getElementById('batchTestContainer');
    const accessible = results.filter(r => r.accessible);
    const inaccessible = results.filter(r => !r.accessible);

    let html = `
        <div class="enhanced-info">
            <h4>✅ 批量测试完成</h4>
            <p><strong>总计:</strong> ${results.length} 个URL</p>
            <p><strong>可访问:</strong> <span class="success-badge">${accessible.length}</span></p>
            <p><strong>不可访问:</strong> <span class="warning-badge">${inaccessible.length}</span></p>
        </div>
    `;

    if (accessible.length > 0) {
        html += `
            <div class="enhanced-info">
                <h4>🟢 可访问的路由</h4>
                <ul class="info-list">
        `;
        accessible.forEach(result => {
            const riskLevel = result.original.includes('admin') || result.original.includes('manage') ? ' 🔴' : 
                             result.hasParams ? ' 🟡' : ' 🟢';
            html += `<li>
                <a href="${result.url}" target="_blank" style="color: #41b883; text-decoration: none;">
                    ${result.name || result.original}
                </a>
                <span class="badge">${result.responseTime}ms</span>
                ${riskLevel}
            </li>`;
        });
        html += `</ul></div>`;
    }

    if (inaccessible.length > 0 && inaccessible.length <= 10) {
        html += `
            <div class="enhanced-info">
                <h4>🔴 不可访问的路由</h4>
                <ul class="info-list">
        `;
        inaccessible.slice(0, 10).forEach(result => {
            html += `<li>${result.name || result.original} <span class="warning-badge">${result.status}</span></li>`;
        });
        if (inaccessible.length > 10) {
            html += `<li>... 还有 ${inaccessible.length - 10} 个</li>`;
        }
        html += `</ul></div>`;
    }

    html += `
        <div class="copy-actions">
            <button onclick="exportTestResults(${JSON.stringify(results).replace(/"/g, '&quot;')})" class="secondary-btn">导出测试结果</button>
        </div>
    `;

    container.innerHTML = html;
}

// 导出测试结果
function exportTestResults(results) {
    const csvData = 'URL名称,原始路径,测试URL,状态,响应时间,可访问性\n' +
        results.map(r => `"${r.name}","${r.original}","${r.url}","${r.status}","${r.responseTime}ms","${r.accessible ? '是' : '否'}"`).join('\n');
    
    downloadFile(csvData, 'batch-test-results.csv', 'text/csv;charset=utf-8');
    showBatchTestResult('测试结果已导出', 'success');
}

// 显示批量测试结果消息
function showBatchTestResult(message, type) {
    const container = document.getElementById('batchTestContainer');
    const className = type === 'success' ? 'success-badge' : 'warning-badge';
    container.innerHTML = `<div class="enhanced-info"><span class="${className}">${message}</span></div>`;
    
    if (type === 'error') {
        setTimeout(() => {
            container.innerHTML = '';
        }, 3000);
    }
}

// 监听来自content script的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    safeExecute(() => {
        if (request.action === "vueDetectionResult") {
            displayDetectionResult(request.result);
        }
        else if (request.action === "vueRouterAnalysisResult") {
            displayRouterAnalysis(request.result);
        }
        else if (request.action === "vueDetectionError" || request.action === "vueRouterAnalysisError") {
            showError(request.error || "检测过程中发生错误");
        }
    }, `Message handler: ${request.action}`);
});

// 初始化
document.addEventListener('DOMContentLoaded', init);