import {
    IvsClient,
    CreateChannelCommand,
    GetStreamKeyCommand,
    StopStreamCommand,
    ChannelLatencyMode,
    ChannelType,
} from "@aws-sdk/client-ivs"
import { prisma } from "@/lib/prisma"
import { GetStreamCommand } from "@aws-sdk/client-ivs"

export const ivs = new IvsClient({
    region: process.env.AWS_REGION,
})

export interface CreatorChannelInfo {
    channelArn:     string
    ingestEndpoint: string
    playbackUrl:    string
    streamKeyArn:   string
}

export async function ensureCreatorChannel(
    creatorId: string,
): Promise<CreatorChannelInfo> {
    const creator = await prisma.creator.findUnique({
        where:  { id: creatorId },
        select: {
            ivsChannelArn:     true,
            ivsIngestEndpoint: true,
            ivsPlaybackUrl:    true,
            ivsStreamKeyArn:   true,
            displayName:       true,
        },
    })
    if (!creator) throw new Error("Creator not found")

    if (
        creator.ivsChannelArn &&
        creator.ivsIngestEndpoint &&
        creator.ivsPlaybackUrl &&
        creator.ivsStreamKeyArn
    ) {
        return {
            channelArn:     creator.ivsChannelArn,
            ingestEndpoint: creator.ivsIngestEndpoint,
            playbackUrl:    creator.ivsPlaybackUrl,
            streamKeyArn:   creator.ivsStreamKeyArn,
        }
    }

    const res = await ivs.send(
        new CreateChannelCommand({
            name:        `nesora-${creatorId}`,
            type:        ChannelType.StandardChannelType,
            latencyMode: ChannelLatencyMode.LowLatency,
            authorized:  false,
            tags:        { app: "nesora", creator: creatorId },
        }),
    )

    const channel   = res.channel
    const streamKey = res.streamKey

    if (!channel?.arn || !channel.ingestEndpoint || !channel.playbackUrl) {
        throw new Error("IVS CreateChannel returned incomplete channel data")
    }
    if (!streamKey?.arn) {
        throw new Error("IVS CreateChannel returned no stream key")
    }

    const info: CreatorChannelInfo = {
        channelArn:     channel.arn,
        ingestEndpoint: channel.ingestEndpoint,
        playbackUrl:    channel.playbackUrl,
        streamKeyArn:   streamKey.arn,
    }

    await prisma.creator.update({
        where: { id: creatorId },
        data: {
            ivsChannelArn:     info.channelArn,
            ivsIngestEndpoint: info.ingestEndpoint,
            ivsPlaybackUrl:    info.playbackUrl,
            ivsStreamKeyArn:   info.streamKeyArn,
        },
    })

    return info
}

export async function getStreamKeyValue(streamKeyArn: string): Promise<string> {
    const res = await ivs.send(
        new GetStreamKeyCommand({ arn: streamKeyArn }),
    )
    const value = res.streamKey?.value
    if (!value) throw new Error("Could not retrieve stream key value")
    return value
}

export async function stopChannelStream(channelArn: string): Promise<void> {
    try {
        await ivs.send(new StopStreamCommand({ channelArn }))
    } catch (err: any) {
        // Not broadcasting = already stopped; safe to ignore.
        if (err?.name === "ChannelNotBroadcasting") return
        throw err
    }
}

export async function getChannelStreamState(
    channelArn: string,
): Promise<{ live: true; streamId: string; startedAt?: Date } | { live: false }> {
    try {
        const res = await ivs.send(new GetStreamCommand({ channelArn }))
        const s = res.stream
        if (s?.state === "LIVE") {
            return { live: true, streamId: s.streamId ?? "", startedAt: s.startTime }
        }
        return { live: false }
    } catch (err: any) {
        if (err?.name === "ChannelNotBroadcasting") return { live: false }
        throw err
    }
}