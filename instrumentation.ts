// instrumentation.ts  ← Next.js built-in hook, runs once on server start
export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { startCronJobs } = await import("./lib/cron")
        startCronJobs()
    }
}