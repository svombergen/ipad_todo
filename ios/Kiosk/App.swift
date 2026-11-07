import UIKit
import WebKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        window = UIWindow(frame: UIScreen.main.bounds)
        window?.rootViewController = KioskViewController()
        window?.makeKeyAndVisible()
        return true
    }

    // Kiosk: never auto-lock. iOS resets this after backgrounding, so set it on every activation.
    func applicationDidBecomeActive(_ application: UIApplication) {
        application.isIdleTimerDisabled = true
    }
}

/// Fullscreen WKWebView serving the bundled React app from app://local/ (custom scheme, so ES modules load without file:// CORS issues).
/// State is a JSON string kept in Documents/state.json: injected as window.__SAVED__ at start, written back via the "save" message handler.
final class KioskViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, WKURLSchemeHandler {
    private var webView: WKWebView!
    private let webRoot = Bundle.main.resourceURL!.appendingPathComponent("web", isDirectory: true).standardizedFileURL
    private let stateURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("state.json")
    private let startURL = URL(string: "app://local/index.html")!

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(self, forURLScheme: "app")
        // ponytail: handler retains self (cycle); this VC lives for the whole app lifetime.
        config.userContentController.add(self, name: "save")
        config.dataDetectorTypes = []
        injectSavedState(into: config.userContentController)

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsLinkPreview = false
        webView.allowsBackForwardNavigationGestures = false
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 1, green: 0.91, blue: 0.66, alpha: 1)
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        view = webView
        webView.load(URLRequest(url: startURL))
    }

    private func injectSavedState(into ucc: WKUserContentController) {
        ucc.removeAllUserScripts()
        let saved = (try? String(contentsOf: stateURL, encoding: .utf8)) ?? ""
        // Encode as a JS string literal; the web side JSON.parses it (with fallback to defaults).
        let literal = (try? JSONEncoder().encode(saved)).flatMap { String(data: $0, encoding: .utf8) } ?? "\"\""
        ucc.addUserScript(WKUserScript(source: "window.__SAVED__=\(literal);", injectionTime: .atDocumentStart, forMainFrameOnly: true))
    }

    // MARK: Kiosk chrome

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .all }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .landscape }

    // MARK: Persistence

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "save", let json = message.body as? String else { return }
        do {
            try json.write(to: stateURL, atomically: true, encoding: .utf8)
        } catch {
            NSLog("Kiosk: save failed: \(error)")
        }
    }

    // MARK: Offline lock-down + crash recovery

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let scheme = navigationAction.request.url?.scheme
        decisionHandler(scheme == "app" || scheme == "about" ? .allow : .cancel)
    }

    // 2 GB device: WebContent may get jetsammed. Reload with the latest saved state.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        injectSavedState(into: webView.configuration.userContentController)
        webView.load(URLRequest(url: startURL))
    }

    // WKWebView's confirm()/prompt() return nothing unless the host shows the dialog.
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Annuleer", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "OK", style: .destructive) { _ in completionHandler(true) })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        alert.addTextField { $0.text = defaultText }
        alert.addAction(UIAlertAction(title: "Annuleer", style: .cancel) { _ in completionHandler(nil) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { [weak alert] _ in completionHandler(alert?.textFields?.first?.text) })
        present(alert, animated: true)
    }

    // MARK: app:// scheme -> bundled files

    private static let mime = [
        "html": "text/html", "js": "text/javascript", "css": "text/css", "json": "application/json",
        "svg": "image/svg+xml", "png": "image/png", "jpg": "image/jpeg", "woff2": "font/woff2", "mp3": "audio/mpeg",
    ]

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return task.didFailWithError(URLError(.badURL)) }
        let rel = url.path.isEmpty || url.path == "/" ? "index.html" : String(url.path.dropFirst())
        let file = webRoot.appendingPathComponent(rel).standardizedFileURL
        // Block ../ escapes out of the web folder.
        guard file.path.hasPrefix(webRoot.path + "/"), let data = try? Data(contentsOf: file) else {
            return task.didFailWithError(URLError(.fileDoesNotExist))
        }
        let type = Self.mime[file.pathExtension.lowercased()] ?? "application/octet-stream"
        task.didReceive(HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1",
                                        headerFields: ["Content-Type": type, "Content-Length": String(data.count)])!)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}
