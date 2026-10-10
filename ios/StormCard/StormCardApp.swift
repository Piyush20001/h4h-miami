import SwiftUI
import WebKit

@main
struct StormCardApp: App {
    var body: some Scene { WindowGroup { ContentView() } }
}

/// Thin native shell around the StormCard web app served by the hub laptop on the same Wi-Fi.
struct ContentView: View {
    @AppStorage("server") private var server =
        Bundle.main.object(forInfoDictionaryKey: "StormCardServer") as? String ?? "http://10.88.2.23:8000"
    @State private var editing = false
    @State private var reloadToken = UUID()

    var body: some View {
        WebView(url: URL(string: server), reloadToken: reloadToken)
            .ignoresSafeArea(edges: .bottom)
            .onLongPressGesture(minimumDuration: 1.5) { editing = true }
            .alert("StormCard server", isPresented: $editing) {
                TextField("http://10.88.2.23:8000", text: $server)
                    .keyboardType(.URL).textInputAutocapitalization(.never)
                Button("Connect") { reloadToken = UUID() }
                Button("Cancel", role: .cancel) {}
            } message: { Text("Address of the StormCard laptop on this Wi-Fi.") }
    }
}

struct WebView: UIViewRepresentable {
    let url: URL?
    let reloadToken: UUID

    func makeUIView(context: Context) -> WKWebView {
        let view = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
        view.allowsBackForwardNavigationGestures = true
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {
        guard let url, context.coordinator.loaded != reloadToken else { return }
        context.coordinator.loaded = reloadToken
        view.load(URLRequest(url: url))
    }

    func makeCoordinator() -> Coordinator { Coordinator() }
    final class Coordinator { var loaded: UUID? }
}
