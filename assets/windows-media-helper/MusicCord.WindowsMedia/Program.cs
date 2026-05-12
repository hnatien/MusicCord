using System.Text.Json;
using System.Text.Json.Serialization;
using Windows.Media.Control;

var app = new MusicCordWindowsMedia.App();

if (args.Contains("--once", StringComparer.OrdinalIgnoreCase))
{
    await app.WriteCurrentTrackAsync();
    return;
}

string? line;
while ((line = await Console.In.ReadLineAsync()) is not null)
{
    if (line.Equals("get", StringComparison.OrdinalIgnoreCase))
    {
        await app.WriteCurrentTrackAsync();
    }
}

namespace MusicCordWindowsMedia
{
    internal sealed class App
    {
        private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
        {
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };

        private static readonly string[] AppleMusicSourcePatterns =
        [
            "applemusic",
            "appleinc.applemusic",
            "itunes"
        ];

        private GlobalSystemMediaTransportControlsSessionManager? sessionManager;

        public async Task WriteCurrentTrackAsync()
        {
            try
            {
                sessionManager ??= await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
                var session = SelectSession(sessionManager);
                if (session is null)
                {
                    WriteResponse(new NoneResponse());
                    return;
                }

                var playbackInfo = session.GetPlaybackInfo();
                var status = MapStatus(playbackInfo.PlaybackStatus);
                if (status == "stopped")
                {
                    WriteResponse(new NoneResponse());
                    return;
                }

                var mediaProperties = await session.TryGetMediaPropertiesAsync();
                if (string.IsNullOrWhiteSpace(mediaProperties.Title))
                {
                    WriteResponse(new NoneResponse());
                    return;
                }

                var timeline = session.GetTimelineProperties();
                var sourceAppUserModelId = string.IsNullOrWhiteSpace(session.SourceAppUserModelId)
                    ? null
                    : session.SourceAppUserModelId;
                WriteResponse(new TrackResponse(
                    Title: mediaProperties.Title.Trim(),
                    Artist: string.IsNullOrWhiteSpace(mediaProperties.Artist)
                        ? "Unknown Artist"
                        : mediaProperties.Artist.Trim(),
                    Album: mediaProperties.AlbumTitle?.Trim() ?? string.Empty,
                    Status: status,
                    DurationSeconds: Math.Max(0, (timeline.EndTime - timeline.StartTime).TotalSeconds),
                    PositionSeconds: Math.Max(0, timeline.Position.TotalSeconds),
                    SourceAppUserModelId: sourceAppUserModelId
                ));
            }
            catch (Exception error)
            {
                WriteResponse(new ErrorResponse(error.Message));
            }
        }

        private static GlobalSystemMediaTransportControlsSession? SelectSession(
            GlobalSystemMediaTransportControlsSessionManager manager)
        {
            foreach (var session in manager.GetSessions())
            {
                if (IsAppleMusicSession(session))
                {
                    return session;
                }
            }

            return manager.GetCurrentSession();
        }

        private static bool IsAppleMusicSession(GlobalSystemMediaTransportControlsSession session)
        {
            var sourceAppUserModelId = session.SourceAppUserModelId.ToLowerInvariant();
            return AppleMusicSourcePatterns.Any(sourceAppUserModelId.Contains);
        }

        private static string MapStatus(GlobalSystemMediaTransportControlsSessionPlaybackStatus status) =>
            status switch
            {
                GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing => "playing",
                GlobalSystemMediaTransportControlsSessionPlaybackStatus.Paused => "paused",
                _ => "stopped"
            };

        private static void WriteResponse(HelperResponse response)
        {
            Console.WriteLine(JsonSerializer.Serialize(response, JsonOptions));
            Console.Out.Flush();
        }
    }

    [JsonDerivedType(typeof(NoneResponse))]
    [JsonDerivedType(typeof(TrackResponse))]
    [JsonDerivedType(typeof(ErrorResponse))]
    internal abstract record HelperResponse(string Kind);

    internal sealed record NoneResponse() : HelperResponse("none");

    internal sealed record TrackResponse(
        string Title,
        string Artist,
        string Album,
        string Status,
        double DurationSeconds,
        double PositionSeconds,
        string? SourceAppUserModelId) : HelperResponse("track");

    internal sealed record ErrorResponse(string Message) : HelperResponse("error");
}
