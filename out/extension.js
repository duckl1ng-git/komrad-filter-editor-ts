"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FilterProvider = exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const node_fetch_1 = require("node-fetch");
async function activate(context) {
    console.log('Congratulations, your extension "komrad-filter-editor" is now active!');
    const config = vscode.workspace.getConfiguration('komrad-filter-editor');
    let cookie = config.get('token');
    if (!cookie || cookie === undefined || cookie === null) {
        cookie = await komradLogin();
    }
    if (cookie !== null) {
        const filterProvider = new FilterProvider(await getFiltersList(String(cookie)));
        let filterTree = vscode.window.registerTreeDataProvider('filters-list', filterProvider);
        let filtersList = vscode.commands.registerCommand('filters-list.refresh', () => {
            filterProvider.refresh(String(cookie));
        });
        let filterEdit = vscode.commands.registerCommand('filters-list.edit', (node) => {
            let editor = vscode.window.activeTextEditor;
            let sourceCode = Buffer.from(node.source, 'base64').toString('utf-8');
            if (editor) {
                let range = new vscode.Range(0, 0, editor.document.lineCount, 0);
                editor.edit(editBuilder => {
                    editBuilder.replace(range, sourceCode);
                });
                vscode.window.showInformationMessage(`Фльтр ${node.label} успшно получен`);
            }
            else {
                vscode.window.showErrorMessage('Сначала откроте новое пустое окно (Ctrl+N)');
            }
        });
        let filterUpload = vscode.commands.registerCommand('filters-list.upload', (node) => {
            updateFilter(String(cookie), node);
        });
        context.subscriptions.push(filterTree, filtersList, filterEdit, filterUpload);
    }
}
exports.activate = activate;
async function deactivate() { }
exports.deactivate = deactivate;
async function komradLogin() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const config = vscode.workspace.getConfiguration('komrad-filter-editor');
    const host = config.get('targetUrl');
    const loginPath = '/api/v1/login';
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const loginCreds = { Login: config.get('login'), Password: config.get('password') };
    const loginUrl = host + loginPath;
    let response = await (0, node_fetch_1.default)(loginUrl, {
        method: "POST",
        body: JSON.stringify(loginCreds),
        headers: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "Content-Type": "application/json",
        }
    });
    if (response.ok) {
        console.log('Login successful');
    }
    else {
        console.log('Login failed');
        return null;
    }
    var cookie = "something";
    var param = response.headers.get('set-cookie');
    if (param !== null) {
        var cookies = param.match(/SessionToken=(.*?);/);
        if (cookies !== null) {
            cookie = cookies[1];
        }
    }
    return cookie;
}
async function komradLogout(cookie) {
    const config = vscode.workspace.getConfiguration('komrad-filter-editor');
    const host = config.get('targetUrl');
    const logoutPath = '/api/v1/logout';
    const logoutUrl = host + logoutPath;
    let response = await (0, node_fetch_1.default)(logoutUrl, {
        method: "POST",
        headers: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "Content-Type": "application/json",
            cookie: "SessionToken=" + cookie + ";"
        }
    });
    if (response.ok) {
        console.log('Logout successful');
    }
    else {
        console.log('Logout failed');
    }
}
async function getFiltersList(cookie) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const config = vscode.workspace.getConfiguration('komrad-filter-editor');
    const host = config.get('targetUrl');
    const getFiltersPath = '/api/queries?$sort=CreatedAt&$order=desc&$page=1&$limit=1000&$format=list';
    // let cookie = await komradLogin();
    const getFiltersUrl = host + getFiltersPath;
    let response = await (0, node_fetch_1.default)(getFiltersUrl, {
        method: "GET",
        headers: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "Content-Type": "application/json",
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "Accept": "application/json",
            "cookie": "SessionToken=" + cookie + ";"
        }
    });
    let filters = [];
    if (response.ok) {
        // console.log('Seems request works');
        let data = await response.json();
        // console.log(data.data.Items);
        for (let ind in data['data']['Items']) {
            let filter = new Filter(data['data']['Items'][ind]['Name'], data['data']['Items'][ind]['ID'], data['data']['Items'][ind]['Source'], data['data']['Items'][ind]['CreatedAt'], data['data']['Items'][ind]['Description']);
            filters.push(filter);
        }
        vscode.window.showInformationMessage('Фильтры успешно получены');
    }
    else {
        // console.log('Seems something went wrong');
        vscode.window.showErrorMessage('Не удалось получить фильтры');
        filters = [
            new Filter('name_1', 'id_1', 'source_1', '111', 'desc_1'),
            new Filter('name_2', 'id_2', 'source_2', '222', 'desc_2')
        ];
    }
    return filters;
}
async function updateFilter(cookie, filter) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const config = vscode.workspace.getConfiguration('komrad-filter-editor');
    const host = config.get('targetUrl');
    const patchFiltersPath = '/api/queries/';
    const patchFiltersUrl = host + patchFiltersPath + filter.id;
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        const data = {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            CreatedAt: filter.createdAt,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            Description: `${filter.description}`,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            ID: `${filter.id}`,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            Name: `${filter.label}`,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            RuleTree: null,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            Source: Buffer.from(editor.document.getText(), 'utf-8').toString('base64'),
            // eslint-disable-next-line @typescript-eslint/naming-convention
            SourceType: "lua"
        };
        let response = await (0, node_fetch_1.default)(patchFiltersUrl, {
            method: "PATCH",
            headers: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'Content-Type': 'application/json',
                // eslint-disable-next-line @typescript-eslint/naming-convention
                Accept: 'application/json',
                "cookie": "SessionToken=" + cookie + ";"
            },
            body: JSON.stringify(data)
        });
        if (response.ok) {
            vscode.window.showInformationMessage('Фльтр успешно обновлен. Обновите список фильтров.');
        }
        else {
            console.log(await response.statusText);
            vscode.window.showErrorMessage('Не удалось обновить фильтр! Повторите попытку.');
        }
    }
}
class Filter extends vscode.TreeItem {
    constructor(label, id, source, createdAt, description) {
        super(label);
        this.id = id;
        this.source = source;
        this.createdAt = createdAt;
        this.description = description;
    }
}
class FilterProvider {
    constructor(filters) {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.filters = filters;
    }
    async refresh(cookie) {
        this.filters = await getFiltersList(cookie);
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (element === undefined) {
            return this.filters;
        }
        else {
            return null;
        }
    }
    getParent(element) {
        throw new Error('Method not implemented.');
    }
    resolveTreeItem(item, element, token) {
        throw new Error('Method not implemented.');
    }
}
exports.FilterProvider = FilterProvider;
//# sourceMappingURL=extension.js.map