import com.capacitorjs.plugins.filesystem.FilesystemPlugin
import com.capacitorjs.plugins.share.SharePlugin

class MainActivity:
BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Explicit registration guarantees they are available
        registerPlugin(FilesystemPlugin::class.java)
        registerPlugin(SharePlugin::class.java)
    }
}