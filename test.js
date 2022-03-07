const { exec } = require('child_process')

exec('ls -l sample.txt', (err, stdout, stderr) => {
	if (err) {
		console.log(`stderr: ${stderr}`)
		console.log(stderr)
		return
	}
	console.log(`stdout: ${stdout}`)
})
console.log('test')
