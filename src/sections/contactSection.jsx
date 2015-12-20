"use strict";

var React = require('react');

class ContactSection extends React.Component {
    render() {
        return (
            <section id="contact" className="four">
                <div className="container">

                    <header>
                        <h2>Contact</h2>
                    </header>

                    <p>Elementum sem parturient nulla quam placerat viverra
                        mauris non cum elit tempus ullamcorper dolor. Libero rutrum ut lacinia
                        donec curae mus. Eleifend id porttitor ac ultricies lobortis sem nunc
                        orci ridiculus faucibus a consectetur. Porttitor curae mauris urna mi dolor.</p>

                    <form method="post" action="#">
                        <div className="row">
                            <div className="6u 12u$(mobile)"><input type="text" name="name" placeholder="Name"/>
                            </div>
                            <div className="6u$ 12u$(mobile)"><input type="text" name="email" placeholder="Email"/>
                            </div>
                            <div className="12u$">
                                <textarea name="message" placeholder="Message"></textarea>
                            </div>
                            <div className="12u$">
                                <input type="submit" value="Send Message"/>
                            </div>
                        </div>
                    </form>

                </div>
            </section>
        )
    }
}

module.exports = ContactSection;
