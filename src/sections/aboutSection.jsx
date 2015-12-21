"use strict";

var React = require('react');

class AboutSection extends React.Component {
    render() {
        return (
            <section id="about" className="three">
                <div className="container">

                    <header>
                        <h2>About Me</h2>
                    </header>

                    <a href="#" className="image featured"><img src="images/me.png" alt=""/></a>

                    <p>
                        I am a software developer who is graduated at Fontys University of Applied Science, Eindhoven, the Netherlands,
                        currently working at ThoughtWorks, Beijing. I have development experiences in ASP .NET, Windows UWP Application, Virtual Reality,
                        CE-HTML TV Application, etc. And I am also very interested in many different kinds of frontend development.
                        Coding makes my life colorful!
                    </p>

                </div>
            </section>
        )
    }
}

module.exports = AboutSection;
