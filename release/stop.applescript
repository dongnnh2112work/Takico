-- Tắt server game (không hiện Terminal)
on run
	set appPath to POSIX path of (path to me)
	set gameRoot to do shell script "dirname " & quoted form of appPath
	do shell script "bash " & quoted form of (gameRoot & "/stop-launcher.sh")
end run
