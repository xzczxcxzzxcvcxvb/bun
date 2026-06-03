(function() {
    const patches = [];
    const STORAGE_KEY = "localMessageEdits";
    const storage = vendetta.plugin.storage;
    if (!storage[STORAGE_KEY]) storage[STORAGE_KEY] = {};

    const { findByProps, findByDisplayName } = vendetta.metro;
    const { before, after } = vendetta.patcher;

    function start() {
        try {
            const UserStore = findByProps("getCurrentUser");
            const { React } = findByProps("React") ?? window;
            const RN = findByProps("Text", "View", "TouchableOpacity", "Alert") ?? window.ReactNative;
            const { Text, TouchableOpacity, Alert } = RN;
            const MessageMenu = findByProps("MessageLongPressActionSheet") ?? findByDisplayName("MessageLongPressActionSheet", false);

            if (MessageMenu) {
                patches.push(
                    after("default", MessageMenu, (args, res) => {
                        const msg = args?.[0]?.message;
                        if (!msg) return res;
                        const me = UserStore?.getCurrentUser?.();
                        if (!me || msg.author?.id !== me.id) return res;
                        const items = res?.props?.children;
                        if (!Array.isArray(items)) return res;
                        const existingEdit = storage[STORAGE_KEY][msg.id];
                        items.push(
                            React.createElement(TouchableOpacity, {
                                key: "local-edit",
                                style: { paddingVertical: 14, paddingHorizontal: 16 },
                                onPress() {
                                    Alert.prompt("Edit locally", "Only visible to you", [
                                        { text: "Cancel", style: "cancel" },
                                        { text: "Save", onPress(val) { if (val != null) storage[STORAGE_KEY][msg.id] = val; } }
                                    ], "plain-text", existingEdit ?? msg.content);
                                }
                            }, React.createElement(Text, { style: { color: "#00b0f4", fontSize: 16 } }, "✏️  Edit locally"))
                        );
                        if (existingEdit) {
                            items.push(
                                React.createElement(TouchableOpacity, {
                                    key: "local-edit-clear",
                                    style: { paddingVertical: 14, paddingHorizontal: 16 },
                                    onPress() { delete storage[STORAGE_KEY][msg.id]; }
                                }, React.createElement(Text, { style: { color: "#f04747", fontSize: 16 } }, "🗑️  Clear local edit"))
                            );
                        }
                        return res;
                    })
                );
            }

            const MessageContent = findByDisplayName("MessageContent", false) ?? findByProps("renderMessageContent");
            if (MessageContent) {
                const target = MessageContent.default ? MessageContent : { default: MessageContent };
                patches.push(
                    before("default", target, (args) => {
                        const msg = args?.[0]?.message;
                        if (!msg) return;
                        const override = storage[STORAGE_KEY][msg.id];
                        if (override !== undefined) {
                            args[0] = { ...args[0], message: { ...msg, content: override } };
                        }
                    })
                );
            }
        } catch (e) {
            console.error("[LocalMessageEditor] start error:", e);
        }
    }

    function stop() {
        patches.forEach(p => p?.());
        patches.length = 0;
    }

    return { onLoad: start, onUnload: stop };
})();
