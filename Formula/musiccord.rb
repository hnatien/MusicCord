class Musiccord < Formula
  desc "Apple Music Rich Presence for Discord"
  homepage "https://github.com/hnatien/MusicCord"
  head "https://github.com/hnatien/MusicCord.git", branch: "main"

  depends_on "node"

  def install
    system "npm", "ci"
    system "npm", "run", "build"
    system "npm", "prune", "--omit=dev"

    libexec.install Dir["dist", "node_modules", "package.json", "package-lock.json", "README.md"]

    (bin/"musiccord").write <<~EOS
      #!/bin/bash
      exec "#{Formula["node"].opt_bin}/node" "#{libexec}/dist/index.js" "$@"
    EOS
    chmod 0755, bin/"musiccord"
  end

  service do
    run [opt_bin/"musiccord"]
    keep_alive true
    log_path var/"log/musiccord.log"
    error_log_path var/"log/musiccord.log"
    working_dir HOMEBREW_PREFIX
  end

  test do
    assert_match "Apple Music Rich Presence", shell_output("#{bin}/musiccord --help")
  end
end
