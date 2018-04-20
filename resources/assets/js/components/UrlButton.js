import React from 'react';
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { translate } from 'react-i18next';
import { compose } from "redux";
import $ from "jquery";
import axios from "axios";
import {
    appSettingChecks,
    appSettingForcedChecks,
    appSettings_$,
} from '../helpers/AppSettings';
import appEvents from '../helpers/AppEvents';
import appModal from '../helpers/AppModal';
import ConfirmationButtons from "./ConfirmationButtons";

const boxedImmutable = require('boxed-immutable');

const util = boxedImmutable.util;

function normalizeProp(prop, defaultValue) {
    if (util.isValid(prop)) {
        if (util.isFunction(prop)) {
            return prop(defaultValue);
        }
        return prop;
    }
    return defaultValue;
}

class UrlButton extends React.Component {
    constructor(props) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
    }

    static messageModal(modalTitle, modalBody, props) {
        const onButtonClose = function onClose(e, ok) {
            console.log("Modal closed", ok);
            appModal.hideModal();
        }.bind(this);

        const modal = {
            onClose: null,
            modalProps: Object.assign({}, props, {
                modalTitle: modalTitle,
            }),
            modalBody: modalBody,
        };
        appModal.showModal(modal);
    }

    handleClick(e) {
        const { t } = this.props;
        e.preventDefault();
        e.stopPropagation();

        if (appModal.inButtonOp || normalizeProp(this.props.disabled)) return;
        appModal.inButtonOp = true;

        const $el = $(e.target);

        const normalizedUrlData = normalizeProp(this.props.dataUrl);
        const dataUrl = util.isObjectLike(normalizedUrlData) ? normalizedUrlData : { url: normalizedUrlData };
        const reloadGroups = this.props.reloadGroups;
        const disableWith = this.props.disableWith;
        const confirmationKey = this.props.confirmationKey;
        const confirmationBody = this.props.confirmationBody || null;
        const invalidateGroup = this.props.invalidateGroup;
        const onConfirmed = this.props.onConfirmed;
        const onSuccess = this.props.onSuccess;
        const onFailure = this.props.onFailure;

        const doUpdate = (util.isFunction(onConfirmed) ? function () {
            try {
                onConfirmed();
            } finally {
                appModal.inButtonOp = false;
            }
        } : function () {
            let restoreText;
            if (disableWith) {
                restoreText = $el.text();
                $el.text(normalizeProp(disableWith));
            }

            // $el.attr('disabled', true);
            $el.addClass('busy');
            (dataUrl.type && dataUrl.type.toLowerCase() === 'get' ? axios.get : axios.post)(dataUrl.url, dataUrl.data)
                .then(result => {
                    if (restoreText) $el.text(restoreText);
                    $el.removeAttr('disabled');
                    $el.removeClass('busy');
                    restoreText = null;

                    appModal.inButtonOp = false;

                    if (result.data.status === 'ok') {
                        if (invalidateGroup) {
                            appEvents.fireEvent('invalidate.translations', normalizeProp(invalidateGroup));
                            appEvents.fireEvent('invalidate.group');
                        }

                        if (normalizeProp(reloadGroups)) {
                            // group deleted
                            appEvents.fireEvent('invalidate.groups');
                        }

                        if (onSuccess) {
                            window.setTimeout(() => {
                                onSuccess(result);
                            }, 100);
                        }
                    } else {
                        // must be an error
                        if (onFailure) {
                            window.setTimeout(() => {
                                onFailure(null, result);
                            }, 100);
                        } else {
                            const errors = util.isArray(result.data.error) ?
                                <ul>{result.data.error.map((message, index) =>
                                    <li key={index}
                                        dangerouslySetInnerHTML={{ __html: message }}/>,
                                )}</ul> : <p>{result.data.error}</p>;
                            UrlButton.messageModal(t('messages.server-error-title'), (
                                <div>
                                    <p>{t('messages.server-error-response')}</p>
                                    {errors}
                                </div>
                            ), {
                                headerType: 'bg-danger text-white',
                            });
                        }
                    }

                    console.log("Operation complete", dataUrl, result.data);
                })
                .catch((e) => {
                    if (restoreText) $el.text(restoreText);
                    $el.removeAttr('disabled');
                    $el.removeClass('busy');
                    appModal.inButtonOp = false;

                    window.setTimeout(() => {
                        if (onFailure) {
                            onFailure(e);
                        } else {
                            UrlButton.messageModal(t('messages.server-error-title'), (
                                <div>
                                    <p>{t('messages.server-error-message')}</p>
                                    {e.message}
                                </div>
                            ), {
                                headerType: 'bg-danger text-white',
                            });
                        }
                    }, 100);
                })
            ;
        }).bind(this);

        if (confirmationKey) {
            const normalizedConfirmationKey = normalizeProp(confirmationKey);
            if (appSettings_$.uiSettings[normalizedConfirmationKey]()) {

                const confirmationDashCase = normalizedConfirmationKey ? appSettingChecks[normalizedConfirmationKey] : null;
                const forcedConfirmationCheck = normalizedConfirmationKey ? appSettingForcedChecks[normalizedConfirmationKey] : null;
                if (!confirmationDashCase) {
                    console.error(normalizedConfirmationKey + " missing dashCase entry in appSettings appSettingChecks", confirmationDashCase);
                }

                const classes = $el.attr('class').split(' ');
                let okBtnType = 'btn-outline-primary';
                let cancelBtnType = 'btn-outline-secondary';
                let btnSize = "";

                classes.forEach(cls => {
                    switch (cls) {
                        case 'btn-sm' :
                            btnSize = 'btn-sm';
                            break;

                        case 'btn' :
                            break;

                        case 'btn-lg' :
                            btnSize = cls;
                            break;

                        default:
                            if (cls.match(/^btn-outline-[a-z]+$/)) {
                                okBtnType = cls;
                            } else if (cls.match(/^btn-[a-z]+$/)) {
                                okBtnType = 'btn-outline-' + cls.substr(4);
                            }
                            break;
                    }

                });

                const okBtnClass = `btn ${btnSize} ${okBtnType}`;
                const cancelBtnClass = `btn ${btnSize} ${cancelBtnType}`;

                const onButtonClose = function onClose(e, ok) {
                    console.log("Modal closed", ok);
                    appModal.hideModal();

                    if (ok) {
                        doUpdate();
                    } else {
                        appModal.inButtonOp = false;
                    }
                }.bind(this);

                const onDialogClose = function onClose(e) {
                    console.log("Modal closed");
                    appModal.inButtonOp = false;
                }.bind(this);

                const modal = {
                    onClose: onDialogClose,
                    modalProps: {
                        modalTitle: t('messages.' + confirmationDashCase + "-title"),
                        modalType: '',
                        footer: (
                            <ConfirmationButtons
                                onNeverShow={forcedConfirmationCheck === undefined ? normalizedConfirmationKey : null}
                                okText={t('messages.' + confirmationDashCase.substring("confirm-".length))}
                                okButtonType={okBtnClass}
                                neverShowButtonType={okBtnClass}
                                cancelButtonType={cancelBtnClass}
                                onClose={onButtonClose}
                            />
                        ),
                    },
                    modalBody:
                        confirmationBody ?
                            <div>{normalizeProp(confirmationBody, t('messages.' + confirmationDashCase + "-message"))}</div>
                            : <p>{t('messages.' + confirmationDashCase + "-message")}</p>,
                };
                appModal.showModal(modal);
            } else {
                doUpdate();
            }
        } else {
            doUpdate();
        }
    }

    render() {
        const { t } = this.props;

        return !this.props.plainLink ? (
            !this.props.asLink ? (
                <button ref={el => this.el = el}
                    type={this.props.type || "button"}
                    onClick={this.handleClick}
                    className={this.props.className}
                >{this.props.children}</button>
            ) : (
                <a ref={el => this.el = el}
                    href='#'
                    title={this.props.title || ''}
                    onClick={this.handleClick}
                    className={this.props.className}
                >{this.props.children}</a>
            )
        ) : (
            <a
                role='button'
                className={this.props.className}
                href={normalizeProp(this.props.dataUrl.url)}
                {...normalizeProp(this.props.disabled) ? { disabled: true } : {}}
            >{this.props.children}</a>
        );
    }
}

UrlButton.propTypes = {
    plainLink: PropTypes.bool,
    asLink: PropTypes.bool,
    disable: PropTypes.any,
    dataUrl: PropTypes.any,
    onConfirmed: PropTypes.func,
    onSuccess: PropTypes.func,
    onFailure: PropTypes.func,
    reloadGroups: PropTypes.any,
    invalidateGroup: PropTypes.any,
    confirmationKey: PropTypes.any,
    confirmationBody: PropTypes.any,
    disableWith: PropTypes.any,
};

export default compose(translate(), connect())(UrlButton);