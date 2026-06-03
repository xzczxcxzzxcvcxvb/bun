(({ plugin, patcher, metro, flux }) => {
    const patches = [];
    const STORAGE_KEY = "localMessageEdits";

    // Get storage
    const storage = plugin.storage;
    if (!storage[STORAGE_KEY]) storage[STORAGE_KEY] = {};

    // Metro finders via window.bunny
    const { findByProps, findByName, findByDisplayName } = window.bunny?.metro ?? metro;

    return {
        start() {
            try {
                const { before, after } = window.bunny?.patcher ?? patcher;

                // Find the message long press action sheet
                const ActionSheetUtils = findByProps("openLazy", "hideActionSheet");
                const UserStore = findByProps("getCurrentUser");
                const { React } = findByProps("React") ?? window;
                const { Text, TouchableOpacity, View, Alert, TextInput } = findByProps("Text", "View", "TouchableOpacity") ?? window.ReactNative;

                // Patch message context menu to add "Edit locally"
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
                                        Alert.prompt(
                                            "Edit locally",
                                            "Only visible to you",
                                            [
                                                { text: "Cancel", style: "cancel" },
                                                {
                                                    text: "Save",
                                                    onPress(val) {
                                                        if (val != null) storage[STORAGE_KEY][msg.id] = val;
                                                    }
                                                }
                                            ],
                                            "plain-text",
                                            existingEdit ?? msg.content
                                        );
                                    }
                                },
                                    React.createElement(Text, { style: { color: "#00b0f4", fontSize: 16 } }, "✏️  Edit locally")
                                )
                            );

                            if (existingEdit) {
                                items.push(
                                    React.createElement(TouchableOpacity, {
                                        key: "local-edit-clear",
                                        style: { paddingVertical: 14, paddingHorizontal: 16 },
                                        onPress() {
                                            delete storage[STORAGE_KEY][msg.id];
                                        }
                                    },
                                        React.createElement(Text, { style: { color: "#f04747", fontSize: 16 } }, "🗑️  Clear local edit")
                                    )
                                );
                            }

                            return res;
                        })
                    );
                }

                // Patch message content rendering to swap in overrides
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
        },

        stop() {
            patches.forEach(p => p?.());
            patches.length = 0;
        }
    };
});
