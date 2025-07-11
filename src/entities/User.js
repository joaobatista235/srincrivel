class User {

    /**
     * @param {int} id 
     * @param {string} username 
     * @param {string} audio 
     */
    constructor(id, username, audio) {
        this.id = id;
        this.username = username;
        this.audio = audio;
    }

    hasAudioConfigured() {
        return Boolean(this.audio);
    }
}

export default User;