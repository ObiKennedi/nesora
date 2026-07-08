export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { startCallCron } = await import("@/lib/call-cron")
        startCallCron()
    }
}